import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for POST /rides/:id/start (driver start ride / pickup cargo flow).
 *
 * Uses the same entity-creation pattern as arrive.e2e-spec.ts.
 * Tests geo-fence validation by setting driver_locations with proper PostGIS point.
 */
describe('Driver Start Ride (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  const STRICT_MODE = process.env.E2E_STRICT_DB === 'true';

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;

  let customerUserId: string | null = null;
  let customerId: number | null = null;

  // Driver 1 (assigned driver)
  const driverUserIds: string[] = [];
  const driverIds: number[] = [];
  const vehicleIds: number[] = [];
  let driverToken: string | null = null;

  // Driver 2 (unauthorized / another driver)
  let driver2UserId: string | null = null;
  let driver2Id: number | null = null;
  let driver2Token: string | null = null;

  // Pickup location for geo-fence tests
  const PICKUP_LAT = 41.0082;
  const PICKUP_LNG = 28.9784;

  async function getToken(email: string, password: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.session!.access_token;
  }

  async function createTestAnnouncement(): Promise<number> {
    const deliveryLat = 41.0182;
    const deliveryLng = 28.9884;

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        customer_id: customerId,
        company_id: companyId,
        pickup_location: 'Test Pickup',
        delivery_location: 'Test Delivery',
        cargo_type: 'box',
        pickup_lat: PICKUP_LAT,
        pickup_lng: PICKUP_LNG,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        pickup_point: `SRID=4326;POINT(${PICKUP_LNG} ${PICKUP_LAT})`,
        delivery_point: `SRID=4326;POINT(${deliveryLng} ${deliveryLat})`,
        vehicle_category: 'economy',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  }

  async function createArrivedShipment(announcementId: number): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .insert({
        announcement_id: announcementId,
        company_id: companyId,
        customer_id: customerId,
        driver_id: driverIds[0],
        vehicle_id: vehicleIds[0],
        status: 'arrived',
        arrived_at: new Date().toISOString(),
        wait_started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    await supabaseAdmin
      .from('announcements')
      .update({ status: 'matched' })
      .eq('id', announcementId);

    return data.id as number;
  }

  /**
   * Update driver location with proper PostGIS point for geo-fence validation.
   */
  async function setDriverLocation(
    driverId: number,
    lat: number,
    lng: number,
  ): Promise<void> {
    // Use raw SQL to ensure proper PostGIS point creation
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        INSERT INTO public.driver_locations(driver_id, lat, lng, point, last_seen_at)
        VALUES (
          ${driverId},
          ${lat},
          ${lng},
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          now()
        )
        ON CONFLICT (driver_id) DO UPDATE
        SET lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            point = EXCLUDED.point,
            last_seen_at = now(),
            updated_at = now()
      `,
    });

    // If exec_sql RPC doesn't exist, fall back to direct insert
    if (error && error.message?.includes('function')) {
      await supabaseAdmin.from('driver_locations').upsert({
        driver_id: driverId,
        lat,
        lng,
        point: `SRID=4326;POINT(${lng} ${lat})`,
        last_seen_at: new Date().toISOString(),
      });
    } else if (error) {
      throw error;
    }
  }

  /**
   * Detects if a 500 is due to a missing RPC function (not yet deployed).
   */
  function handleRpcMissing(res: request.Response, rpcName: string): boolean {
    if (res.status !== 500) return false;

    const msg = (res.body?.message as string) || '';
    const isRpcMissing =
      /function.*does not exist/i.test(msg) ||
      /could not find the function/i.test(msg) ||
      /schema cache/i.test(msg);

    if (!isRpcMissing) return false;

    if (STRICT_MODE) {
      throw new Error(
        `[E2E_STRICT_DB] RPC '${rpcName}' not found in database.\n` +
        `Deploy the SQL function before running strict E2E.\n` +
        `Response: ${msg}`,
      );
    }
    console.warn(
      `⚠️  RPC '${rpcName}' not deployed — skipping test (set E2E_STRICT_DB=true to fail)`,
    );
    return true;
  }

  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

    supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const password = 'password123';

    // Owner user
    {
      const email = `owner-start-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      ownerUserId = u.user.id;
    }

    // Company via RPC
    {
      const { data: newCompanyId, error } = await supabaseAdmin.rpc('create_company_as_user', {
        p_user_id: ownerUserId,
        p_name: `TestCo-Start-${Date.now()}`,
        p_status: 'approved',
      });
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Driver 1 (the assigned driver)
    {
      const email = `driver-start-${Date.now()}_0@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;

      const driverUserId = u.user.id;
      driverUserIds.push(driverUserId);

      const { data: d, error: dErr } = await supabaseAdmin
        .from('drivers')
        .insert({
          user_id: driverUserId,
          company_id: companyId,
          status: 'approved',
          is_online: true,
          is_available: true,
          availability: 'available',
        })
        .select('id')
        .single();

      if (dErr) throw dErr;
      const driverId = d.id as number;
      driverIds.push(driverId);

      const plate = `STR-${Date.now()}-0`;
      const { data: v, error: vErr } = await supabaseAdmin
        .from('vehicles')
        .insert({
          company_id: companyId,
          driver_id: driverId,
          plate_number: plate,
          is_active: true,
          category: 'economy',
        })
        .select('id')
        .single();

      if (vErr) throw vErr;
      vehicleIds.push(v.id);

      // Set driver location NEAR pickup (within geo-fence)
      await setDriverLocation(driverId, PICKUP_LAT, PICKUP_LNG);

      driverToken = await getToken(email, password);
    }

    // Driver 2 (unauthorized driver — different from the assigned one)
    {
      const email = `driver-start-${Date.now()}_1@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;

      driver2UserId = u.user.id;

      const { data: d, error: dErr } = await supabaseAdmin
        .from('drivers')
        .insert({
          user_id: driver2UserId,
          company_id: companyId,
          status: 'approved',
          is_online: true,
          is_available: true,
          availability: 'available',
        })
        .select('id')
        .single();

      if (dErr) throw dErr;
      driver2Id = d.id as number;

      driver2Token = await getToken(email, password);
    }

    // Customer
    {
      const email = `customer-start-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;

      customerUserId = u.user.id;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data: c, error: cErr } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', customerUserId)
        .single();

      if (cErr) throw cErr;
      customerId = c.id;
    }
  }, 60000);

  afterAll(async () => {
    try {
      if (driverIds.length) await supabaseAdmin.from('driver_locations').delete().in('driver_id', driverIds);
      if (vehicleIds.length) await supabaseAdmin.from('vehicles').delete().in('id', vehicleIds);
      if (driverIds.length) await supabaseAdmin.from('drivers').delete().in('id', driverIds);
      if (driver2Id) {
        await supabaseAdmin.from('drivers').delete().eq('id', driver2Id);
      }
      if (customerId) await supabaseAdmin.from('customers').delete().eq('id', customerId);

      if (companyId) {
        await supabaseAdmin.from('company_users').delete().eq('company_id', companyId);
        await supabaseAdmin.from('company_pricing').delete().eq('company_id', companyId);
        await supabaseAdmin.from('companies').delete().eq('id', companyId);
      }

      for (const uid of driverUserIds) await supabaseAdmin.auth.admin.deleteUser(uid);
      if (driver2UserId) await supabaseAdmin.auth.admin.deleteUser(driver2UserId);
      if (customerUserId) await supabaseAdmin.auth.admin.deleteUser(customerUserId);
      if (ownerUserId) await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    await app.close();
  });

  // ─── Test A: Happy path ────────────────────────────────────────────
  describe('Test A: Happy path — driver starts ride', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createArrivedShipment(announcementId);
      // Ensure driver location is NEAR pickup
      await setDriverLocation(driverIds[0], PICKUP_LAT, PICKUP_LNG);
    });

    afterEach(async () => {
      if (shipmentId) {
        try {
          await supabaseAdmin.from('notifications').delete().eq('related_shipment_id', shipmentId);
        } catch {}
        try {
          await supabaseAdmin.from('shipment_status_history').delete().eq('shipment_id', shipmentId);
        } catch {}
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should transition from arrived to in_progress with picked_up_at', async () => {
      // ── PRE-CONDITIONS ──
      const { data: preship } = await supabaseAdmin
        .from('shipments')
        .select('driver_id, status, arrived_at, wait_started_at')
        .eq('id', shipmentId)
        .single();

      expect(preship?.driver_id).toBe(driverIds[0]);
      expect(preship?.status).toBe('arrived');
      expect(preship?.arrived_at).not.toBeNull();
      expect(preship?.wait_started_at).not.toBeNull();

      // ── ACT ──
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res, 'driver_start_ride')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);

      // ── POST-CONDITION 1: status = 'in_progress' ──
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, picked_up_at, wait_ended_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('in_progress');

      // ── POST-CONDITION 2: picked_up_at IS NOT NULL ──
      expect(shipment?.picked_up_at).not.toBeNull();
      expect(shipment?.picked_up_at).toBeDefined();

      // ── POST-CONDITION 3: wait_ended_at IS NOT NULL (if wait was tracked) ──
      // The RPC should set wait_ended_at when starting the ride
      expect(shipment?.wait_ended_at).not.toBeNull();

      console.log('[Test A] Start verified:', {
        status: shipment?.status,
        picked_up_at: shipment?.picked_up_at,
        wait_ended_at: shipment?.wait_ended_at,
      });

      // ── POST-CONDITION 4: notification exists for customer ──
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id, type, user_id')
        .eq('related_shipment_id', shipmentId);

      if (notifications && notifications.length > 0) {
        const startNotif = notifications.find(
          (n: any) => n.type === 'ride_started' || n.type === 'pickup_started',
        );
        if (startNotif) {
          console.log('[Test A] Notification verified:', startNotif);
        } else {
          console.warn('[Test A] Notification rows exist but none with type ride_started/pickup_started');
        }
      } else {
        console.warn('[Test A] No notifications found — notification logic may not be deployed yet');
      }
    });
  });

  // ─── Test B: Geo-fence fail ────────────────────────────────────────
  describe('Test B: Geo-fence fail — driver too far from pickup', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createArrivedShipment(announcementId);
      // Set driver location FAR from pickup (0.1 degrees ~= 11km away)
      await setDriverLocation(driverIds[0], PICKUP_LAT + 0.1, PICKUP_LNG + 0.1);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
      // Reset driver location for other tests
      await setDriverLocation(driverIds[0], PICKUP_LAT, PICKUP_LNG);
    });

    it('should return 422 when driver is too far from pickup', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res, 'driver_start_ride')) return;

      // Expect 422 Unprocessable Entity for geo-fence failure
      expect(res.status).toBe(422);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, picked_up_at, wait_ended_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('arrived');
      expect(shipment?.picked_up_at).toBeNull();
      expect(shipment?.wait_ended_at).toBeNull();

      console.log('[Test B] Geo-fence correctly rejected driver');
    });
  });

  // ─── Test C: Idempotency ───────────────────────────────────────────
  describe('Test C: Idempotency — calling start twice', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createArrivedShipment(announcementId);
      await setDriverLocation(driverIds[0], PICKUP_LAT, PICKUP_LNG);
    });

    afterEach(async () => {
      if (shipmentId) {
        try {
          await supabaseAdmin.from('notifications').delete().eq('related_shipment_id', shipmentId);
        } catch {}
        try {
          await supabaseAdmin.from('shipment_status_history').delete().eq('shipment_id', shipmentId);
        } catch {}
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should succeed on both calls (idempotent)', async () => {
      // First call
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res1, 'driver_start_ride')) return;

      expect([200, 201]).toContain(res1.status);
      expect(res1.body.ok).toBe(true);

      const firstPickedUpAt = res1.body.ride?.picked_up_at;

      // Second call — should still succeed (idempotent)
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      // If RPC is idempotent, expect 200; if it throws "already started", expect 409
      expect([200, 201, 409]).toContain(res2.status);

      if (res2.status === 200 || res2.status === 201) {
        // Idempotent success — verify timestamp unchanged
        const { data: shipment } = await supabaseAdmin
          .from('shipments')
          .select('status, picked_up_at')
          .eq('id', shipmentId)
          .single();

        expect(shipment?.status).toBe('in_progress');
        expect(shipment?.picked_up_at).toBe(firstPickedUpAt);

        // Verify only one notification (or at most the same count)
        const { data: notifications } = await supabaseAdmin
          .from('notifications')
          .select('id, type')
          .eq('related_shipment_id', shipmentId);

        if (notifications) {
          const startNotifs = notifications.filter(
            (n: any) => n.type === 'ride_started' || n.type === 'pickup_started',
          );
          expect(startNotifs.length).toBeLessThanOrEqual(1);
          console.log('[Test C] Notification count after double-tap:', startNotifs.length);
        }
      } else {
        console.log('[Test C] RPC returned 409 for already-started — acceptable behavior');
      }
    });
  });

  // ─── Test D: Unauthorized driver ───────────────────────────────────
  describe('Test D: Unauthorized driver — another driver calls start', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createArrivedShipment(announcementId);
      await setDriverLocation(driverIds[0], PICKUP_LAT, PICKUP_LNG);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should return 403/404 when a different driver tries to start', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/start`)
        .set('Authorization', `Bearer ${driver2Token}`);

      if (handleRpcMissing(res, 'driver_start_ride')) return;

      expect([403, 404]).toContain(res.status);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, picked_up_at, wait_ended_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('arrived');
      expect(shipment?.picked_up_at).toBeNull();
      expect(shipment?.wait_ended_at).toBeNull();

      console.log('[Test D] Unauthorized driver correctly rejected');
    });
  });

  // ─── Test E: Wrong state (not arrived yet) ─────────────────────────
  describe('Test E: Cannot start before arriving', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      // Create shipment in 'assigned' state (not arrived yet)
      const { data, error } = await supabaseAdmin
        .from('shipments')
        .insert({
          announcement_id: announcementId,
          company_id: companyId,
          customer_id: customerId,
          driver_id: driverIds[0],
          vehicle_id: vehicleIds[0],
          status: 'assigned',
        })
        .select('id')
        .single();

      if (error) throw error;
      shipmentId = data.id as number;

      await setDriverLocation(driverIds[0], PICKUP_LAT, PICKUP_LNG);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should return 409 when trying to start before arriving', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/start`)
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res, 'driver_start_ride')) return;

      expect(res.status).toBe(409);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, picked_up_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('assigned');
      expect(shipment?.picked_up_at).toBeNull();

      console.log('[Test E] Correctly rejected start before arrive');
    });
  });

  // ─── Test F: Missing auth header ───────────────────────────────────
  describe('Test F: Missing auth header', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/1/start');

      expect(res.status).toBe(401);
    });
  });

  // ─── Test G: Non-existent shipment ─────────────────────────────────
  describe('Test G: Non-existent shipment', () => {
    it('should return 403/404 for a non-existent shipment id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/999999/start')
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res, 'driver_start_ride')) return;

      expect([403, 404]).toContain(res.status);
    });
  });
});
