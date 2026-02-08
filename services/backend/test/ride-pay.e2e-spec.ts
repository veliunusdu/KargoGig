import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for POST /rides/:id/pay (Day 2 — Payment via ride endpoint).
 *
 * Tests:
 *   A — Happy path: checkout + callback → paid
 *   B — Not completed → 409
 *   C — Pending idempotency (same platform_order_id)
 *   D — Already paid → 409
 *   E — Unauthorized customer → 403/401
 *   F — Missing auth → 401
 */
describe('Ride Pay (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;

  let customerUserId: string | null = null;
  let customerId: number | null = null;
  let customerToken: string | null = null;

  let customer2UserId: string | null = null;
  let customer2Id: number | null = null;
  let customer2Token: string | null = null;

  let driverUserId: string | null = null;
  let driverId: number | null = null;
  let vehicleId: number | null = null;

  const shipmentIds: number[] = [];
  const announcementIds: number[] = [];
  const offerIds: number[] = [];

  const password = 'password123';

  async function getToken(email: string, pw: string): Promise<string> {
    // Use a separate anon client for sign-in so supabaseAdmin keeps its service-role context
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) throw error;
    return data.session!.access_token;
  }

  /**
   * Create an announcement + shipment pair.
   */
  async function createShipment(opts: {
    status: string;
    finalPrice?: number;
    custId?: number;
  }): Promise<number> {
    const pickupLat = 41.0082;
    const pickupLng = 28.9784;
    const deliveryLat = 41.0182;
    const deliveryLng = 28.9884;

    const { data: ann, error: annErr } = await supabaseAdmin
      .from('announcements')
      .insert({
        customer_id: opts.custId ?? customerId,
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
        status: 'matched',
      })
      .select('id')
      .single();

    if (annErr) throw annErr;
    announcementIds.push(ann.id);

    // Create offer (required FK for shipment)
    const { data: offer, error: offerErr } = await supabaseAdmin
      .from('offers')
      .insert({
        announcement_id: ann.id,
        company_id: companyId,
        price: opts.finalPrice ?? 50,
        status: 'accepted',
      })
      .select('id')
      .single();
    if (offerErr) throw offerErr;
    offerIds.push(offer.id);

    const insertData: any = {
      offer_id: offer.id,
      announcement_id: ann.id,
      company_id: companyId,
      customer_id: opts.custId ?? customerId,
      driver_id: driverId,
      vehicle_id: vehicleId,
      status: opts.status,
    };

    if (opts.finalPrice !== undefined) {
      insertData.final_price = opts.finalPrice;
    }

    // If status is 'completed', set delivered_at (source of truth)
    if (opts.status === 'completed') {
      insertData.delivered_at = new Date().toISOString();
    }

    const { data: ship, error: shipErr } = await supabaseAdmin
      .from('shipments')
      .insert(insertData)
      .select('id')
      .single();

    if (shipErr) throw shipErr;
    shipmentIds.push(ship.id);

    return ship.id as number;
  }

  // ───────────────────────────────────────────────────────────────
  // Setup / Teardown
  // ───────────────────────────────────────────────────────────────

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

    // Owner user
    {
      const email = `owner-ridepay-${Date.now()}@test.dev`;
      const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      ownerUserId = u.user.id;
    }

    // Company
    {
      const { data: cid, error } = await supabaseAdmin.rpc('create_company_as_user', {
        p_user_id: ownerUserId,
        p_name: `TestCo-RidePay-${Date.now()}`,
        p_status: 'approved',
      });
      if (error) throw error;
      companyId = cid;
    }

    // Customer 1 (owner of shipments)
    {
      const email = `customer-ridepay-${Date.now()}_1@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      customerUserId = u.user.id;

      // Check if customer was auto-created by trigger
      const { data: existing } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', customerUserId)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: c, error: cErr } = await supabaseAdmin
          .from('customers')
          .insert({ user_id: customerUserId, phone: '5550001111' })
          .select('id')
          .single();
        if (cErr) throw cErr;
        customerId = c.id;
      }

      customerToken = await getToken(email, password);
    }

    // Customer 2 (unauthorized for shipments)
    {
      const email = `customer-ridepay-${Date.now()}_2@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      customer2UserId = u.user.id;

      // Check if customer was auto-created by trigger
      const { data: existing } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', customer2UserId)
        .maybeSingle();

      if (existing) {
        customer2Id = existing.id;
      } else {
        const { data: c, error: cErr } = await supabaseAdmin
          .from('customers')
          .insert({ user_id: customer2UserId, phone: '5550002222' })
          .select('id')
          .single();
        if (cErr) throw cErr;
        customer2Id = c.id;
      }

      customer2Token = await getToken(email, password);
    }

    // Driver
    {
      const email = `driver-ridepay-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      driverUserId = u.user.id;

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
      driverId = d.id;
    }

    // Vehicle
    {
      const { data: v, error: vErr } = await supabaseAdmin
        .from('vehicles')
        .insert({
          driver_id: driverId,
          company_id: companyId,
          plate_number: `PAY-${Date.now()}`,
          category: 'economy',
        })
        .select('id')
        .single();
      if (vErr) throw vErr;
      vehicleId = v.id;
    }
  }, 30000);

  afterAll(async () => {
    // Clean payments first (FK)
    if (shipmentIds.length) {
      await supabaseAdmin.from('payments').delete().in('shipment_id', shipmentIds);
    }
    if (shipmentIds.length) {
      await supabaseAdmin.from('shipments').delete().in('id', shipmentIds);
    }
    if (offerIds.length) {
      await supabaseAdmin.from('offers').delete().in('id', offerIds);
    }
    if (announcementIds.length) {
      await supabaseAdmin.from('announcements').delete().in('id', announcementIds);
    }
    if (vehicleId) await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
    if (driverId) await supabaseAdmin.from('drivers').delete().eq('id', driverId);
    if (customerId) await supabaseAdmin.from('customers').delete().eq('id', customerId);
    if (customer2Id) await supabaseAdmin.from('customers').delete().eq('id', customer2Id);
    if (companyId) await supabaseAdmin.from('companies').delete().eq('id', companyId);
    if (customerUserId) await supabaseAdmin.auth.admin.deleteUser(customerUserId);
    if (customer2UserId) await supabaseAdmin.auth.admin.deleteUser(customer2UserId);
    if (driverUserId) await supabaseAdmin.auth.admin.deleteUser(driverUserId);
    if (ownerUserId) await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    await app.close();
  }, 30000);

  // ───────────────────────────────────────────────────────────────
  // Test A — Happy path: checkout → callback → paid
  // ───────────────────────────────────────────────────────────────
  describe('Test A: Happy path', () => {
    let shipmentId: number;
    let platformOrderId: string;

    beforeAll(async () => {
      shipmentId = await createShipment({ status: 'completed', finalPrice: 87.5 });
    });

    it('should create pending payment via /rides/:id/pay', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${shipmentId}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('provider', 'mock');
      expect(res.body).toHaveProperty('platform_order_id');
      expect(res.body.platform_order_id).toMatch(/^PO-/);
      expect(res.body).toHaveProperty('checkout_url');
      expect(res.body.checkout_url).toContain('/mock-pay/');

      platformOrderId = res.body.platform_order_id;

      // DB: payment row is pending
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('platform_order_id', platformOrderId)
        .single();

      expect(payment).toBeTruthy();
      expect(payment.status).toBe('pending');
      expect(payment.shipment_id).toBe(shipmentId);
      expect(payment.amount).toBe(87.5);
      expect(payment.currency).toBe('TRY');
      expect(payment.provider).toBe('mock');
    });

    it('should mark paid after callback success', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
          provider_payment_id: 'MOCK-HAPPY-001',
        })
        .expect(200);

      expect(res.body).toEqual({ ok: true, status: 'paid' });

      // DB: payment is paid
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('status, paid_at, provider_payment_id, callback_payload')
        .eq('platform_order_id', platformOrderId)
        .single();

      expect(payment).toBeTruthy();
      expect(payment!.status).toBe('paid');
      expect(payment!.paid_at).toBeTruthy();
      expect(payment!.provider_payment_id).toBe('MOCK-HAPPY-001');
      expect(payment!.callback_payload).toBeTruthy();
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test B — Not completed → 409
  // ───────────────────────────────────────────────────────────────
  describe('Test B: Shipment not completed', () => {
    it('should reject in_progress shipment', async () => {
      const sid = await createShipment({ status: 'in_progress', finalPrice: 50 });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);

      expect(res.body.message).toMatch(/not completed/i);

      // DB: no payment created
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('shipment_id', sid);

      expect(payments?.length ?? 0).toBe(0);
    });

    it('should reject assigned shipment', async () => {
      const sid = await createShipment({ status: 'assigned' });

      await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);
    });

    it('should reject shipment with final_price but no delivered_at (critical bug test)', async () => {
      // This is the bug: status might say 'completed' or 'picked_up',
      // and final_price might exist, but delivered_at is NULL.
      // Payment MUST NOT be created without delivered_at.
      const pickupLat = 41.0082;
      const pickupLng = 28.9784;
      const deliveryLat = 41.0182;
      const deliveryLng = 28.9884;

      const { data: ann } = await supabaseAdmin
        .from('announcements')
        .insert({
          customer_id: customerId,
          company_id: companyId,
          pickup_location: 'Bug Test Pickup',
          delivery_location: 'Bug Test Delivery',
          cargo_type: 'box',
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          delivery_lat: deliveryLat,
          delivery_lng: deliveryLng,
          pickup_point: `SRID=4326;POINT(${pickupLng} ${pickupLat})`,
          delivery_point: `SRID=4326;POINT(${deliveryLng} ${deliveryLat})`,
          vehicle_category: 'economy',
          status: 'matched',
        })
        .select('id')
        .single();

      announcementIds.push(ann!.id);

      // Create offer (required FK)
      const { data: bugOffer } = await supabaseAdmin
        .from('offers')
        .insert({
          announcement_id: ann!.id,
          company_id: companyId,
          price: 99.99,
          status: 'accepted',
        })
        .select('id')
        .single();
      offerIds.push(bugOffer!.id);

      // Shipment with final_price but NO delivered_at (simulates incomplete RPC bug)
      const { data: ship } = await supabaseAdmin
        .from('shipments')
        .insert({
          offer_id: bugOffer!.id,
          announcement_id: ann!.id,
          company_id: companyId,
          customer_id: customerId,
          driver_id: driverId,
          vehicle_id: vehicleId,
          status: 'picked_up', // or even 'completed' - doesn't matter
          final_price: 99.99,
          delivered_at: null, // ❌ NULL = ride not actually completed
        })
        .select('id')
        .single();

      shipmentIds.push(ship!.id);
      const bugShipmentId = ship!.id;

      // Try to pay → MUST fail with 409
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${bugShipmentId}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);

      expect(res.body.message).toMatch(/not completed/i);

      // DB: no payment created
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('shipment_id', bugShipmentId);

      expect(payments?.length ?? 0).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test C — Pending idempotency
  // ───────────────────────────────────────────────────────────────
  describe('Test C: Pending idempotency', () => {
    it('should return same platform_order_id on repeat calls', async () => {
      const sid = await createShipment({ status: 'completed', finalPrice: 42.0 });

      // First pay call
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const orderId1 = res1.body.platform_order_id;

      // Second pay call — same shipment
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const orderId2 = res2.body.platform_order_id;

      expect(orderId1).toBe(orderId2);

      // DB: only 1 payment row
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('shipment_id', sid);

      expect(payments?.length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test D — Already paid → 409
  // ───────────────────────────────────────────────────────────────
  describe('Test D: Already paid', () => {
    it('should reject pay after payment is completed', async () => {
      const sid = await createShipment({ status: 'completed', finalPrice: 60.0 });

      // Pay
      const payRes = await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      // Mark as paid via callback
      await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: payRes.body.platform_order_id,
          status: 'success',
          provider_payment_id: 'MOCK-PAID',
        })
        .expect(200);

      // Try to pay again → 409
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);

      expect(res.body.message).toMatch(/already completed|already paid/i);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test E — Unauthorized customer
  // ───────────────────────────────────────────────────────────────
  describe('Test E: Unauthorized customer', () => {
    it('should reject another customer paying for shipment', async () => {
      const sid = await createShipment({ status: 'completed', finalPrice: 70.0 });

      // Customer2 tries to pay for Customer1's shipment
      await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .expect(401);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test F — Missing auth
  // ───────────────────────────────────────────────────────────────
  describe('Test F: Missing auth', () => {
    it('should reject pay without auth header', async () => {
      const sid = await createShipment({ status: 'completed', finalPrice: 30.0 });

      await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .expect(401);
    });

    it('should reject pay with invalid token', async () => {
      // Delay to avoid Supabase auth rate limiting (429)
      await new Promise((r) => setTimeout(r, 2000));

      const sid = await createShipment({ status: 'completed', finalPrice: 30.0 });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rides/${sid}/pay`)
        .set('Authorization', 'Bearer invalid-token-xyz');

      // Accept 401 (expected) or 429 (Supabase rate limit)
      expect([401, 429]).toContain(res.status);
    });

    it('should reject non-existent shipment', async () => {
      // Delay to avoid Supabase auth rate limiting (429)
      await new Promise((r) => setTimeout(r, 2000));

      const res = await request(app.getHttpServer())
        .post('/api/v1/rides/999999/pay')
        .set('Authorization', `Bearer ${customerToken}`);

      // Accept 404 (expected) or 429 (Supabase rate limit)
      expect([404, 429]).toContain(res.status);
    });
  });
});
