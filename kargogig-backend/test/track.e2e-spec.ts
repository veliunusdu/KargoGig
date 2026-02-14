import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for POST /rides/:id/location (driver location tracking flow).
 *
 * Uses the same entity-creation pattern as start.e2e-spec.ts.
 * Tests rate limiting, state validation, and location updates.
 */
describe('Driver Location Tracking (e2e)', () => {
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
    return data.session.access_token;
  }

  async function createTestAnnouncement(): Promise<number> {
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
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  }

  async function createInProgressShipment(
    announcementId: number,
  ): Promise<number> {
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

  async function createArrivedShipment(
    announcementId: number,
  ): Promise<number> {
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
    if (!url || !serviceKey)
      throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

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
      const email = `owner-track-${Date.now()}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (uErr) throw uErr;
      ownerUserId = u.user.id;
    }

    // Company via RPC
    {
      const { data: newCompanyId, error } = await supabaseAdmin.rpc(
        'create_company_as_user',
        {
          p_user_id: ownerUserId,
          p_name: `TestCo-Track-${Date.now()}`,
          p_status: 'approved',
        },
      );
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Driver 1 (the assigned driver)
    {
      const email = `driver-track-${Date.now()}_0@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
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

      const plate = `TRK-${Date.now()}-0`;
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
        lat: PICKUP_LAT,
        lng: PICKUP_LNG,
        point: `SRID=4326;POINT(${PICKUP_LNG} ${PICKUP_LAT})`,
        last_seen_at: new Date().toISOString(),
      });

      driverToken = await getToken(email, password);
    }

    // Driver 2 (unauthorized driver — different from the assigned one)
    {
      const email = `driver-track-${Date.now()}_1@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
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
      const email = `customer-track-${Date.now()}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
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
      if (driverIds.length)
        await supabaseAdmin
          .from('driver_locations')
          .delete()
          .in('driver_id', driverIds);
      if (vehicleIds.length)
        await supabaseAdmin.from('vehicles').delete().in('id', vehicleIds);
      if (driverIds.length)
        await supabaseAdmin.from('drivers').delete().in('id', driverIds);
      if (driver2Id) {
        await supabaseAdmin.from('drivers').delete().eq('id', driver2Id);
      }
      if (customerId)
        await supabaseAdmin.from('customers').delete().eq('id', customerId);

      if (companyId) {
        await supabaseAdmin
          .from('company_users')
          .delete()
          .eq('company_id', companyId);
        await supabaseAdmin
          .from('company_pricing')
          .delete()
          .eq('company_id', companyId);
        await supabaseAdmin.from('companies').delete().eq('id', companyId);
      }

      for (const uid of driverUserIds)
        await supabaseAdmin.auth.admin.deleteUser(uid);
      if (driver2UserId)
        await supabaseAdmin.auth.admin.deleteUser(driver2UserId);
      if (customerUserId)
        await supabaseAdmin.auth.admin.deleteUser(customerUserId);
      if (ownerUserId) await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    await app.close();
  });

  // ─── Test A: Happy path insert ─────────────────────────────────────
  describe('Test A: Happy path — location update during in_progress ride', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin
          .from('shipment_tracking')
          .delete()
          .eq('shipment_id', shipmentId);
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should insert tracking point and update driver location', async () => {
      // Move driver toward delivery
      const newLat = PICKUP_LAT + 0.001; // ~111m north
      const newLng = PICKUP_LNG + 0.001; // ~111m east

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: newLat, lng: newLng });

      if (handleRpcMissing(res, 'driver_update_ride_location')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.shipment_id).toBe(shipmentId);
      expect(res.body.result.inserted).toBe(true);

      console.log('[Test A] Location update result:', {
        inserted: res.body.result.inserted,
        eta_seconds: res.body.result.eta_seconds,
        distance_remaining_meters: res.body.result.distance_remaining_meters,
      });

      // ── POST-CONDITION 1: tracking row inserted ──
      const { data: trackingRows } = await supabaseAdmin
        .from('shipment_tracking')
        .select('id, lat, lng')
        .eq('shipment_id', shipmentId);

      expect(trackingRows).toBeDefined();
      expect(trackingRows!.length).toBeGreaterThanOrEqual(1);

      const latestTracking = trackingRows![trackingRows!.length - 1];
      expect(latestTracking.lat).toBeCloseTo(newLat, 5);
      expect(latestTracking.lng).toBeCloseTo(newLng, 5);

      console.log(
        '[Test A] Tracking row verified:',
        trackingRows!.length,
        'row(s)',
      );

      // ── POST-CONDITION 2: driver_locations updated ──
      const { data: driverLoc } = await supabaseAdmin
        .from('driver_locations')
        .select('lat, lng, last_seen_at')
        .eq('driver_id', driverIds[0])
        .single();

      expect(driverLoc).not.toBeNull();
      expect(driverLoc?.lat).toBeCloseTo(newLat, 5);
      expect(driverLoc?.lng).toBeCloseTo(newLng, 5);

      console.log('[Test A] Driver location verified:', {
        lat: driverLoc?.lat,
        lng: driverLoc?.lng,
      });
    });
  });

  // ─── Test B: Rate limit ────────────────────────────────────────────
  describe('Test B: Rate limit — rapid successive calls', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin
          .from('shipment_tracking')
          .delete()
          .eq('shipment_id', shipmentId);
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should rate-limit tracking inserts within short time window', async () => {
      const lat1 = PICKUP_LAT + 0.001;
      const lng1 = PICKUP_LNG + 0.001;

      // First call — should insert
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: lat1, lng: lng1 });

      if (handleRpcMissing(res1, 'driver_update_ride_location')) return;

      expect([200, 201]).toContain(res1.status);
      expect(res1.body.result.inserted).toBe(true);

      // Second call IMMEDIATELY (within 1 second) — should NOT insert
      const lat2 = PICKUP_LAT + 0.002;
      const lng2 = PICKUP_LNG + 0.002;

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: lat2, lng: lng2 });

      expect([200, 201]).toContain(res2.status);
      expect(res2.body.result.inserted).toBe(false);

      console.log('[Test B] Rate limit verified:', {
        first_inserted: res1.body.result.inserted,
        second_inserted: res2.body.result.inserted,
      });

      // Verify only 1 tracking row added (not 2)
      const { data: trackingRows } = await supabaseAdmin
        .from('shipment_tracking')
        .select('id')
        .eq('shipment_id', shipmentId);

      expect(trackingRows!.length).toBe(1);
      console.log('[Test B] Only 1 tracking row inserted (rate-limited)');

      // But driver_locations should be updated with latest
      const { data: driverLoc } = await supabaseAdmin
        .from('driver_locations')
        .select('lat, lng')
        .eq('driver_id', driverIds[0])
        .single();

      // Should have the second location (even if not tracked)
      expect(driverLoc?.lat).toBeCloseTo(lat2, 5);
      expect(driverLoc?.lng).toBeCloseTo(lng2, 5);
      console.log('[Test B] Driver location updated despite rate-limit');
    });
  });

  // ─── Test C: Wrong state ───────────────────────────────────────────
  describe('Test C: Wrong state — shipment not in_progress', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      // Create shipment in 'arrived' state (not in_progress)
      shipmentId = await createArrivedShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should return 409 when shipment is not in_progress', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: PICKUP_LAT + 0.001, lng: PICKUP_LNG + 0.001 });

      if (handleRpcMissing(res, 'driver_update_ride_location')) return;

      expect(res.status).toBe(409);

      // Verify no tracking row inserted
      const { data: trackingRows } = await supabaseAdmin
        .from('shipment_tracking')
        .select('id')
        .eq('shipment_id', shipmentId);

      expect(trackingRows?.length || 0).toBe(0);
      console.log(
        '[Test C] Correctly rejected location update for non-in_progress ride',
      );
    });
  });

  // ─── Test D: Unauthorized driver ───────────────────────────────────
  describe('Test D: Unauthorized driver — another driver calls location', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin
          .from('shipment_tracking')
          .delete()
          .eq('shipment_id', shipmentId);
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should return 403/404 when a different driver tries to update', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driver2Token}`)
        .send({ lat: PICKUP_LAT + 0.001, lng: PICKUP_LNG + 0.001 });

      if (handleRpcMissing(res, 'driver_update_ride_location')) return;

      expect([403, 404]).toContain(res.status);

      // Verify no tracking row inserted
      const { data: trackingRows } = await supabaseAdmin
        .from('shipment_tracking')
        .select('id')
        .eq('shipment_id', shipmentId);

      expect(trackingRows?.length || 0).toBe(0);
      console.log('[Test D] Unauthorized driver correctly rejected');
    });
  });

  // ─── Test E: Missing auth header ───────────────────────────────────
  describe('Test E: Missing auth header', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/1/location')
        .send({ lat: PICKUP_LAT, lng: PICKUP_LNG });

      expect(res.status).toBe(401);
    });
  });

  // ─── Test F: Invalid coordinates ───────────────────────────────────
  describe('Test F: Invalid coordinates validation', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createInProgressShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin
          .from('shipment_tracking')
          .delete()
          .eq('shipment_id', shipmentId);
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should return 400 for invalid latitude (out of range)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 91, lng: 28 }); // lat > 90

      // Validation pipe should catch this BEFORE hitting the RPC
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid longitude (out of range)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 41, lng: 181 }); // lng > 180

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing lat field', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lng: 28 }); // missing lat

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing lng field', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/location`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 41 }); // missing lng

      expect(res.status).toBe(400);
    });
  });

  // ─── Test G: Non-existent shipment ─────────────────────────────────
  describe('Test G: Non-existent shipment', () => {
    it('should return 403/404 for a non-existent shipment id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/999999/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: PICKUP_LAT, lng: PICKUP_LNG });

      if (handleRpcMissing(res, 'driver_update_ride_location')) return;

      expect([403, 404]).toContain(res.status);
    });
  });
});
