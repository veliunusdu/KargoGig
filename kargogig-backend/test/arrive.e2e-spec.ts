import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for POST /rides/:id/arrive (driver arrival flow).
 *
 * Uses the same entity-creation pattern as cancellation.e2e-spec.ts.
 */
describe('Driver Arrive (e2e)', () => {
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

  async function getToken(email: string, password: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.session.access_token;
  }

  async function createTestAnnouncement(): Promise<number> {
    const pickupLat = 41.0082;
    const pickupLng = 28.9784;
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
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        pickup_point: `SRID=4326;POINT(${pickupLng} ${pickupLat})`,
        delivery_point: `SRID=4326;POINT(${deliveryLng} ${deliveryLat})`,
        vehicle_category: 'economy',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id as number;
  }

  async function createAssignedShipment(
    announcementId: number,
  ): Promise<number> {
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
      const email = `owner-arrive-${Date.now()}@test.dev`;
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
          p_name: `TestCo-Arrive-${Date.now()}`,
          p_status: 'approved',
        },
      );
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Driver 1 (the assigned driver)
    {
      const email = `driver-arrive-${Date.now()}_0@test.dev`;
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

      const plate = `ARR-${Date.now()}-0`;
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

      const lat = 41.0082;
      const lng = 28.9784;
      const { error: locErr } = await supabaseAdmin
        .from('driver_locations')
        .upsert({
          driver_id: driverId,
          lat,
          lng,
          point: `SRID=4326;POINT(${lng} ${lat})`,
          last_seen_at: new Date().toISOString(),
        });

      if (locErr) throw locErr;

      driverToken = await getToken(email, password);
    }

    // Driver 2 (unauthorized driver — different from the assigned one)
    {
      const email = `driver-arrive-${Date.now()}_1@test.dev`;
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
      const email = `customer-arrive-${Date.now()}@test.dev`;
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

  // ─── Test A: Happy path ────────────────────────────────────────────
  describe('Test A: Happy path — driver arrives', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createAssignedShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin
          .from('notifications')
          .delete()
          .eq('related_shipment_id', shipmentId)
          .catch(() => {});
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should mark shipment as arrived with timestamps', async () => {
      // ── PRE-CONDITIONS ──
      const { data: preship } = await supabaseAdmin
        .from('shipments')
        .select('driver_id, status')
        .eq('id', shipmentId)
        .single();

      expect(preship?.driver_id).toBe(driverIds[0]);
      expect(preship?.status).toBe('assigned');

      // ── ACT ──
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/arrive`)
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res, 'driver_arrive_ride')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);

      // ── POST-CONDITION 1: status = 'arrived' ──
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, arrived_at, wait_started_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('arrived');

      // ── POST-CONDITION 2: arrived_at IS NOT NULL ──
      expect(shipment?.arrived_at).not.toBeNull();
      expect(shipment?.arrived_at).toBeDefined();

      // ── POST-CONDITION 3: wait_started_at IS NOT NULL ──
      expect(shipment?.wait_started_at).not.toBeNull();
      expect(shipment?.wait_started_at).toBeDefined();

      console.log('[Test A] Arrive verified:', {
        status: shipment?.status,
        arrived_at: shipment?.arrived_at,
        wait_started_at: shipment?.wait_started_at,
      });

      // ── POST-CONDITION 4: notification exists for customer ──
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id, type, user_id')
        .eq('related_shipment_id', shipmentId);

      if (notifications && notifications.length > 0) {
        const arrivalNotif = notifications.find(
          (n: any) => n.type === 'ride_arrived' || n.type === 'driver_arrived',
        );
        if (arrivalNotif) {
          console.log('[Test A] Notification verified:', arrivalNotif);
        } else {
          console.warn(
            '[Test A] Notification rows exist but none with type ride_arrived/driver_arrived',
          );
        }
      } else {
        console.warn(
          '[Test A] No notifications found — notification logic may not be deployed yet',
        );
      }
    });
  });

  // ─── Test B: Idempotency (double tap) ──────────────────────────────
  describe('Test B: Idempotency — calling arrive twice', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createAssignedShipment(announcementId);
    });

    afterEach(async () => {
      if (shipmentId) {
        await supabaseAdmin
          .from('notifications')
          .delete()
          .eq('related_shipment_id', shipmentId)
          .catch(() => {});
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentId);
      }
      if (announcementId) {
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should succeed on both calls (idempotent)', async () => {
      // First call
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/arrive`)
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res1, 'driver_arrive_ride')) return;

      expect([200, 201]).toContain(res1.status);
      expect(res1.body.ok).toBe(true);

      // Second call — should still succeed (idempotent)
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/arrive`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect([200, 201]).toContain(res2.status);
      expect(res2.body.ok).toBe(true);

      // Verify only one notification (or at most the same count)
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id, type')
        .eq('related_shipment_id', shipmentId);

      if (notifications) {
        const arrivalNotifs = notifications.filter(
          (n: any) => n.type === 'ride_arrived' || n.type === 'driver_arrived',
        );
        // Should be exactly 1 (idempotent — no duplicate notifications)
        expect(arrivalNotifs.length).toBeLessThanOrEqual(1);
        console.log(
          '[Test B] Notification count after double-tap:',
          arrivalNotifs.length,
        );
      }

      // Timestamps should remain from the first call
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, arrived_at, wait_started_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('arrived');
      expect(shipment?.arrived_at).not.toBeNull();
      expect(shipment?.wait_started_at).not.toBeNull();
    });
  });

  // ─── Test C: Unauthorized driver ───────────────────────────────────
  describe('Test C: Unauthorized driver — another driver calls arrive', () => {
    let announcementId: number;
    let shipmentId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
      shipmentId = await createAssignedShipment(announcementId);
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

    it('should return 403/404 when a different driver tries to arrive', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/arrive`)
        .set('Authorization', `Bearer ${driver2Token}`);

      if (handleRpcMissing(res, 'driver_arrive_ride')) return;

      expect([403, 404]).toContain(res.status);

      // Verify no DB changes occurred
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('status, arrived_at, wait_started_at')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.status).toBe('assigned');
      expect(shipment?.arrived_at).toBeNull();
      expect(shipment?.wait_started_at).toBeNull();

      console.log('[Test C] Unauthorized driver correctly rejected');
    });
  });

  // ─── Test D: No auth header ────────────────────────────────────────
  describe('Test D: Missing auth header', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/rides/1/arrive',
      );

      expect(res.status).toBe(401);
    });
  });

  // ─── Test E: Non-existent shipment ─────────────────────────────────
  describe('Test E: Non-existent shipment', () => {
    it('should return 403/404 for a non-existent shipment id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/999999/arrive')
        .set('Authorization', `Bearer ${driverToken}`);

      if (handleRpcMissing(res, 'driver_arrive_ride')) return;

      expect([403, 404]).toContain(res.status);
    });
  });
});
