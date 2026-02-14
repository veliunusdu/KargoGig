import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for ride cancellation flows.
 *
 * This test file uses the EXACT same pattern as matching.e2e-spec.ts
 * for driver creation to avoid RLS issues.
 */
describe('Ride Cancellation (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;
  let sbAnon: SupabaseClient; // Login only — never use for seed

  // Strict mode for CI
  const STRICT_MODE = process.env.E2E_STRICT_DB === 'true';

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;

  let customerUserId: string | null = null;
  let customerId: number | null = null;
  let customerToken: string | null = null;

  const driverUserIds: string[] = [];
  const driverIds: number[] = [];
  const vehicleIds: number[] = [];
  let driverToken: string | null = null;

  async function getToken(email: string, password: string): Promise<string> {
    const { data, error } = await sbAnon.auth.signInWithPassword({
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
   * - STRICT_MODE (E2E_STRICT_DB=true) → throws so CI fails
   * - Otherwise → warns and returns true (caller should `return` to skip)
   *
   * Uses PostgreSQL's specific error pattern to avoid false positives
   * with legitimate "not found" app errors (404s).
   */
  function handleRpcMissing(res: request.Response, rpcName: string): boolean {
    if (res.status !== 500) return false;

    const msg = (res.body?.message as string) || '';
    // PostgreSQL: "Could not find the function public.xxx(...) in the schema cache"
    // or: "function public.xxx(...) does not exist"
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

    const anonKey = process.env.SUPABASE_ANON_KEY!;
    sbAnon = createClient(url, anonKey, {
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

    // Owner user (same pattern as matching.e2e-spec.ts)
    {
      const email = `owner${Date.now()}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (uErr) throw uErr;
      ownerUserId = u.user.id;
    }

    // Company via RPC (same pattern as matching.e2e-spec.ts)
    {
      const { data: newCompanyId, error } = await supabaseAdmin.rpc(
        'create_company_as_user',
        {
          p_user_id: ownerUserId,
          p_name: `TestCo-${Date.now()}`,
          p_status: 'approved',
        },
      );
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Driver (EXACT same pattern as matching.e2e-spec.ts)
    {
      const email = `driver${Date.now()}_0@test.dev`;
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

      const plate = `TST-${Date.now()}-0`;
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

    // Customer (same pattern as matching.e2e-spec.ts)
    {
      const email = `customer${Date.now()}@test.dev`;
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

      customerToken = await getToken(email, password);
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
      if (customerUserId)
        await supabaseAdmin.auth.admin.deleteUser(customerUserId);
      if (ownerUserId) await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    } catch (e) {
      console.error('Cleanup error:', e);
    }

    await app.close();
  });

  describe('Authentication & Validation', () => {
    it('should return 401 for customer cancel without auth header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/1/cancel')
        .send({ reason: 'test' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for driver cancel without auth header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/1/driver-cancel')
        .send({ reason: 'test' });

      expect(res.status).toBe(401);
    });

    it('should return 400 for driver cancel when missing required reason', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/1/driver-cancel')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('Test A: Customer cancel (fee = 0)', () => {
    let announcementId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
    });

    afterEach(async () => {
      if (announcementId) {
        await supabaseAdmin
          .from('shipments')
          .delete()
          .eq('announcement_id', announcementId);
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should cancel announcement with fee = 0', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'changed_mind' });

      if (handleRpcMissing(res, 'customer_cancel_announcement')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.fee_amount).toBe(0);
    });
  });

  describe('Test B: Customer cancel idempotency', () => {
    let announcementId: number;

    beforeEach(async () => {
      announcementId = await createTestAnnouncement();
    });

    afterEach(async () => {
      if (announcementId) {
        await supabaseAdmin
          .from('shipments')
          .delete()
          .eq('announcement_id', announcementId);
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should return 409 when cancelling already cancelled ride', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'first_cancel' });

      if (handleRpcMissing(res1, 'customer_cancel_announcement')) return;

      expect([200, 201]).toContain(res1.status);

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'second_cancel' });

      expect([400, 409]).toContain(res2.status);
    });
  });

  describe('Test C: Driver cancel -> unassign + rebroadcast', () => {
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
          .from('announcement_broadcast_batches')
          .delete()
          .eq('announcement_id', announcementId);
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);
      }
    });

    it('should unassign driver and attempt rebroadcast (full DB verification)', async () => {
      // ---- PRE-CONDITIONS (DB sanity check) ----
      const { data: preship } = await supabaseAdmin
        .from('shipments')
        .select('driver_id, status')
        .eq('id', shipmentId)
        .single();

      expect(preship?.driver_id).toBe(driverIds[0]);
      expect(preship?.status).toBe('assigned');

      // ---- ACT: driver cancels via endpoint (user token, not admin) ----
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/driver-cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ reason: 'vehicle_issue' });

      if (handleRpcMissing(res, 'driver_cancel_assignment')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.shipment_id).toBe(shipmentId);
      expect(typeof res.body.result.rebroadcasted).toBe('boolean');

      // ---- POST-CONDITION 1: shipment.driver_id must be NULL ----
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('driver_id, status, cancellation_reason')
        .eq('id', shipmentId)
        .single();

      expect(shipment?.driver_id).toBeNull();
      expect(shipment?.cancellation_reason).toBe('vehicle_issue');
      // Status should reflect driver cancellation
      expect(['driver_cancelled', 'cancelled', 'unassigned']).toContain(
        shipment?.status,
      );

      // ---- POST-CONDITION 2: announcement status reverts for rebroadcast ----
      const { data: announcement } = await supabaseAdmin
        .from('announcements')
        .select('status')
        .eq('id', announcementId)
        .single();

      // After driver cancel, announcement should be re-broadcastable
      expect(['pending', 'broadcasting', 'rebroadcasting']).toContain(
        announcement?.status,
      );

      // ---- POST-CONDITION 3: rebroadcast batch created (if applicable) ----
      const { rebroadcasted, new_batch_id } = res.body.result;

      if (rebroadcasted) {
        expect(new_batch_id).toBeDefined();
        expect(typeof new_batch_id).toBe('number');

        const { data: batch } = await supabaseAdmin
          .from('announcement_broadcast_batches')
          .select('id, announcement_id, status')
          .eq('id', new_batch_id)
          .single();

        expect(batch).not.toBeNull();
        expect(batch?.announcement_id).toBe(announcementId);

        console.log('[Test C] Rebroadcast verified — batch:', {
          id: batch?.id,
          status: batch?.status,
          target_count: res.body.result.new_target_count,
        });
      } else {
        // Even if no rebroadcast (e.g., no eligible drivers), the shipment must still be unassigned
        console.log(
          '[Test C] No rebroadcast (no eligible drivers or RPC chose not to)',
        );
        expect(shipment?.driver_id).toBeNull();
      }

      // ---- POST-CONDITION 4: audit log / customer notification (soft check) ----
      // Check if a cancellation audit row exists (table may not exist yet)
      const { data: auditRows, error: auditErr } = await supabaseAdmin
        .from('shipment_cancellations')
        .select('id, cancelled_by, reason')
        .eq('shipment_id', shipmentId);

      if (!auditErr && auditRows) {
        // Table exists — verify a row was written
        expect(auditRows.length).toBeGreaterThanOrEqual(1);
        const driverCancel = auditRows.find(
          (r: any) => r.cancelled_by === 'driver',
        );
        if (driverCancel) {
          expect(driverCancel.reason).toBe('vehicle_issue');
        }
        console.log('[Test C] Audit log verified:', auditRows.length, 'row(s)');
      } else {
        // Table may not be deployed yet — warn, don't fail
        console.warn(
          '[Test C] shipment_cancellations table not found — audit log not verified',
        );
      }
    });

    it('should return 403/404 for non-existent announcement', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/999999/driver-cancel')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ reason: 'test' });

      if (handleRpcMissing(res, 'driver_cancel_assignment')) return;

      expect([403, 404]).toContain(res.status);
    });

    it('should return 409 if driver tries to cancel already-cancelled shipment', async () => {
      // First cancel
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/driver-cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ reason: 'vehicle_issue' });

      if (handleRpcMissing(res1, 'driver_cancel_assignment')) return;

      expect([200, 201]).toContain(res1.status);

      // Second cancel → should be idempotent rejection
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/driver-cancel`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ reason: 'changed_mind' });

      // RPC should reject: no active assignment to cancel
      expect([400, 403, 404, 409]).toContain(res2.status);
    });
  });

  describe('Test D: Customer cancel with fee (configurable free window)', () => {
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

    it('should charge fee when cancelled outside free window', async () => {
      // This test only makes sense if CANCEL_FREE_WINDOW_MINUTES env is set.
      // When set to 0, ANY cancel after assignment triggers a fee.
      const freeWindowStr = process.env.CANCEL_FREE_WINDOW_MINUTES;
      if (freeWindowStr === undefined) {
        console.warn(
          '[Test D] CANCEL_FREE_WINDOW_MINUTES not set — skipping fee test.\n' +
            'Set CANCEL_FREE_WINDOW_MINUTES=0 to force fee on every cancel.',
        );
        return;
      }

      // Back-date the shipment's assigned_at so it falls outside the free window
      const freeMinutes = parseInt(freeWindowStr, 10) || 0;
      const pastDate = new Date(
        Date.now() - (freeMinutes + 5) * 60_000,
      ).toISOString();

      await supabaseAdmin
        .from('shipments')
        .update({ assigned_at: pastDate })
        .eq('id', shipmentId);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${announcementId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'changed_mind_late' });

      if (handleRpcMissing(res, 'customer_cancel_announcement')) return;

      expect([200, 201]).toContain(res.status);
      expect(res.body.ok).toBe(true);

      // Fee should be > 0 since we're outside the free window
      expect(res.body.result.fee_amount).toBeGreaterThan(0);
      expect(res.body.result.fee_currency).toBeDefined();

      console.log('[Test D] Fee charged:', {
        fee: res.body.result.fee_amount,
        currency: res.body.result.fee_currency,
        payment_id: res.body.result.payment_id,
      });
    });
  });
});
