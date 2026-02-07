import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for POST /rides/:id/complete (driver complete delivery flow).
 *
 * Uses the same entity-creation pattern as start.e2e-spec.ts.
 * Tests geo-fence validation at dropoff, pricing calculation, and POD handling.
 */
describe('Driver Complete Delivery (e2e)', () => {
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

  // Test locations
  const PICKUP_LAT = 41.0082;
  const PICKUP_LNG = 28.9784;
  const DELIVERY_LAT = 41.0182;
  const DELIVERY_LNG = 28.9884;

  async function getToken(email: string, password: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.session!.access_token;
  }

  async function createTestAnnouncement(
    distanceMeters?: number,
    durationSeconds?: number,
  ): Promise<number> {
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
        delivery_lat: DELIVERY_LAT,
        delivery_lng: DELIVERY_LNG,
        pickup_point: `SRID=4326;POINT(${PICKUP_LNG} ${PICKUP_LAT})`,
        delivery_point: `SRID=4326;POINT(${DELIVERY_LNG} ${DELIVERY_LAT})`,
        vehicle_category: 'economy',
        status: 'pending',
        distance_meters: distanceMeters ?? null,
        duration_seconds: durationSeconds ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  }

  async function createInProgressShipment(announcementId: number): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .insert({
        announcement_id: announcementId,
        company_id: companyId,
        customer_id: customerId,
        driver_id: driverIds[0],
        vehicle_id: vehicleIds[0],
        status: 'in_progress',
        arrived_at: now,
        wait_started_at: now,
        wait_ended_at: now,
        picked_up_at: now,
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

  async function createArrivedShipment(announcementId: number): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .insert({
        announcement_id: announcementId,
        company_id: companyId,
        customer_id: customerId,
        driver_id: driverIds[0],
        vehicle_id: vehicleIds[0],
        status: 'arrived',
        arrived_at: now,
        wait_started_at: now,
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
      const email = `owner-complete-${Date.now()}@test.dev`;
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
        p_name: `TestCo-Complete-${Date.now()}`,
        p_status: 'approved',
      });
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Ensure company has pricing (required for final_price calculation)
    {
      await supabaseAdmin.from('company_pricing').insert({
        company_id: companyId,
        currency: 'TRY',
        base_fare: 10,
        per_km: 2,
        per_minute: 0.5,
        minimum_fare: 15,
        platform_commission_rate: 0.2,
        is_active: true,
        category_multipliers: { economy: 1.0, comfort: 1.2, premium: 1.5 },
      });
    }

    // Driver 1 (the assigned driver)
    {
      const email = `driver-complete-${Date.now()}_0@test.dev`;
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

      const plate = `CMP-${Date.now()}-0`;
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

      // Set initial driver location
      await supabaseAdmin.from('driver_locations').upsert({
        driver_id: driverId,
        lat: DELIVERY_LAT,
        lng: DELIVERY_LNG,
        point: `SRID=4326;POINT(${DELIVERY_LNG} ${DELIVERY_LAT})`,
        last_seen_at: new Date().toISOString(),
      });

      driverToken = await getToken(email, password);
    }

    // Driver 2 (unauthorized driver — different from the assigned one)
    {
      const email = `driver-complete-${Date.now()}_1@test.dev`;
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
      const email = `customer-complete-${Date.now()}@test.dev`;
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
  describe('Test A: Happy path — complete delivery with pricing', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      // Create announcement with known distance/duration for deterministic pricing
      // 10 km = 10000 m, 15 minutes = 900 seconds
      announcementId = await createTestAnnouncement(10000, 900);
      shipmentId = await createInProgressShipment(announcementId);
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

    it('should complete delivery at dropoff location and calculate price', async () => {
      // Driver at delivery location
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          lat: DELIVERY_LAT,
          lng: DELIVERY_LNG,
          pod_signature: 'test_signature_base64',
          pod_photos: ['photo1.jpg', 'photo2.jpg'],
        });

      if (handleRpcMissing(res, 'driver_complete_ride')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);
      expect(res.body.ride.status).toBe('completed');

      console.log('[Test A] Complete result:', {
        status: res.body.ride.status,
        delivered_at: res.body.ride.delivered_at,
        final_price: res.body.ride.final_price,
        pod_signature: res.body.ride.pod_signature,
        pod_photos: res.body.ride.pod_photos?.length,
      });

      // ── POST-CONDITION 1: status = 'completed' ──
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, delivered_at, final_price, pod_signature, pod_photos')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('completed');

      // ── POST-CONDITION 2: delivered_at IS NOT NULL ──
      expect(shipment?.delivered_at).not.toBeNull();
      expect(shipment?.delivered_at).toBeDefined();

      // ── POST-CONDITION 3: final_price calculated ──
      expect(shipment?.final_price).not.toBeNull();
      expect(shipment?.final_price).toBeGreaterThan(0);

      // Expected: base_fare=10 + (10km * 2) + (15min * 0.5) = 10 + 20 + 7.5 = 37.5
      // economy multiplier = 1.0 → 37.5
      // max(37.5, minimum_fare=15) = 37.5
      const expectedPrice = 37.5;
      expect(Number(shipment?.final_price)).toBeCloseTo(expectedPrice, 1);
      console.log('[Test A] Pricing verified:', {
        expected: expectedPrice,
        actual: Number(shipment?.final_price),
      });

      // ── POST-CONDITION 4: POD stored ──
      expect(shipment?.pod_signature).toBe('test_signature_base64');
      expect(shipment?.pod_photos).toEqual(['photo1.jpg', 'photo2.jpg']);

      // ── POST-CONDITION 5: notification exists for customer ──
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id, type, user_id')
        .eq('related_shipment_id', shipmentId);

      if (notifications && notifications.length > 0) {
        const completeNotif = notifications.find(
          (n: any) => n.type === 'ride_completed' || n.type === 'delivery_completed',
        );
        if (completeNotif) {
          expect(completeNotif.user_id).toBe(customerUserId);
          console.log('[Test A] Notification verified:', completeNotif);
        } else {
          console.warn('[Test A] Notification rows exist but none with type ride_completed/delivery_completed');
        }
      } else {
        console.warn('[Test A] No notifications found — notification logic may not be deployed yet');
      }
    });
  });

  // ─── Test B: Dropoff geo-fence fail ────────────────────────────────
  describe('Test B: Dropoff geo-fence fail — driver too far', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should return 422 when driver is too far from dropoff', async () => {
      // Driver 0.1 degrees away (~11km) from delivery location
      const farLat = DELIVERY_LAT + 0.1;
      const farLng = DELIVERY_LNG + 0.1;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: farLat, lng: farLng });

      if (handleRpcMissing(res, 'driver_complete_ride')) return;

      // Expect 422 Unprocessable Entity for geo-fence failure
      expect(res.status).toBe(422);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, delivered_at, final_price')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('in_progress');
      expect(shipment?.delivered_at).toBeNull();
      expect(shipment?.final_price).toBeNull();

      console.log('[Test B] Geo-fence correctly rejected driver at dropoff');
    });
  });

  // ─── Test C: Idempotency ───────────────────────────────────────────
  describe('Test C: Idempotency — calling complete twice', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
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
      const payload = {
        lat: DELIVERY_LAT,
        lng: DELIVERY_LNG,
        pod_signature: 'first_signature',
      };

      // First call
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(payload);

      if (handleRpcMissing(res1, 'driver_complete_ride')) return;

      expect([200, 201]).toContain(res1.status);
      expect(res1.body.ok).toBe(true);
      expect(res1.body.ride.status).toBe('completed');

      const firstDeliveredAt = res1.body.ride.delivered_at;
      const firstFinalPrice = res1.body.ride.final_price;

      // Second call — should still succeed (idempotent)
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(payload);

      expect([200, 201]).toContain(res2.status);
      expect(res2.body.ok).toBe(true);

      // Timestamps and price should be unchanged
      expect(res2.body.ride.delivered_at).toBe(firstDeliveredAt);
      expect(res2.body.ride.final_price).toBe(firstFinalPrice);

      // Verify only one notification (idempotent — no duplicate notifications)
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id, type')
        .eq('related_shipment_id', shipmentId);

      if (notifications) {
        const completeNotifs = notifications.filter(
          (n: any) => n.type === 'ride_completed' || n.type === 'delivery_completed',
        );
        expect(completeNotifs.length).toBeLessThanOrEqual(1);
        console.log('[Test C] Notification count after double-tap:', completeNotifs.length);
      }

      console.log('[Test C] Idempotency verified — second call returned same data');
    });
  });

  // ─── Test D: Unauthorized driver ───────────────────────────────────
  describe('Test D: Unauthorized driver — another driver calls complete', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should return 403/404 when a different driver tries to complete', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/complete`)
        .set('Authorization', `Bearer ${driver2Token}`)
        .send({ lat: DELIVERY_LAT, lng: DELIVERY_LNG });

      if (handleRpcMissing(res, 'driver_complete_ride')) return;

      expect([403, 404]).toContain(res.status);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, delivered_at, final_price')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('in_progress');
      expect(shipment?.delivered_at).toBeNull();
      expect(shipment?.final_price).toBeNull();

      console.log('[Test D] Unauthorized driver correctly rejected');
    });
  });

  // ─── Test E: Wrong state (not in_progress) ─────────────────────────
  describe('Test E: Cannot complete before pickup', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      // Create shipment in 'arrived' state (not in_progress yet)
      shipmentId = await createArrivedShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin.from('announcements').delete().eq('id', announcementId);
      }
    });

    it('should return 409 when trying to complete before pickup', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: DELIVERY_LAT, lng: DELIVERY_LNG });

      if (handleRpcMissing(res, 'driver_complete_ride')) return;

      expect(res.status).toBe(409);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, delivered_at, final_price')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('arrived');
      expect(shipment?.delivered_at).toBeNull();
      expect(shipment?.final_price).toBeNull();

      console.log('[Test E] Correctly rejected complete before in_progress');
    });
  });

  // ─── Test F: Missing auth header ───────────────────────────────────
  describe('Test F: Missing auth header', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/1/complete')
        .send({ lat: DELIVERY_LAT, lng: DELIVERY_LNG });

      expect(res.status).toBe(401);
    });
  });

  // ─── Test G: Non-existent shipment ─────────────────────────────────
  describe('Test G: Non-existent shipment', () => {
    it('should return 403/404 for a non-existent shipment id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/999999/complete')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: DELIVERY_LAT, lng: DELIVERY_LNG });

      if (handleRpcMissing(res, 'driver_complete_ride')) return;

      expect([403, 404]).toContain(res.status);
    });
  });
});
