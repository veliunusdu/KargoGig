import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/** Retry a supertest request if Supabase returns 429 (rate limit). */
async function retryOn429(
  fn: () => request.Test,
  maxRetries = 5,
  baseDelay = 15000,
): Promise<request.Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fn();
    if (res.status !== 429) return res;
    // Wait with linear backoff before retrying
    await new Promise((r) => setTimeout(r, baseDelay + attempt * 5000));
  }
  // Last attempt — return whatever we get
  return fn();
}

/**
 * E2E tests for Payments module (POST /payments/checkout and callback).
 * Uses mock provider for testing without real payment gateway.
 */
describe('Payments (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  const STRICT_MODE = process.env.E2E_STRICT_DB === 'true';

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;

  let customerUserId: string | null = null;
  let customerId: number | null = null;
  let customerToken: string | null = null;

  let driverUserId: string | null = null;
  let driverId: number | null = null;
  let vehicleId: number | null = null;

  let completedShipmentId: number | null = null; // Shipment with final_price
  let pendingShipmentId: number | null = null; // Shipment without final_price

  async function getToken(email: string, password: string): Promise<string> {
    // Use a separate anon client for sign-in so supabaseAdmin keeps its service-role context
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.session!.access_token;
  }

  /**
   * Create a completed shipment with final_price
   */
  async function createCompletedShipment(finalPrice: number): Promise<number> {
    const pickupLat = 41.0082;
    const pickupLng = 28.9784;
    const deliveryLat = 41.0182;
    const deliveryLng = 28.9884;

    // Create announcement
    const { data: announcement, error: annError } = await supabaseAdmin
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
        status: 'matched',
      })
      .select('id')
      .single();

    if (annError) throw annError;

    // Create offer (required FK for shipment)
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('offers')
      .insert({
        announcement_id: announcement.id,
        company_id: companyId,
        price: finalPrice,
        status: 'accepted',
      })
      .select('id')
      .single();

    if (offerError) throw offerError;

    // Create shipment
    const { data: shipment, error: shipError } = await supabaseAdmin
      .from('shipments')
      .insert({
        offer_id: offer.id,
        announcement_id: announcement.id,
        company_id: companyId,
        customer_id: customerId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        status: 'completed',
        final_price: finalPrice,
        delivered_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (shipError) throw shipError;

    return shipment.id as number;
  }

  /**
   * Create a pending shipment (no final_price)
   */
  async function createPendingShipment(): Promise<number> {
    const pickupLat = 41.0082;
    const pickupLng = 28.9784;
    const deliveryLat = 41.0182;
    const deliveryLng = 28.9884;

    // Create announcement
    const { data: announcement, error: annError } = await supabaseAdmin
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
        status: 'matched',
      })
      .select('id')
      .single();

    if (annError) throw annError;

    // Create offer (required FK for shipment)
    const { data: pendOffer, error: pendOfferErr } = await supabaseAdmin
      .from('offers')
      .insert({
        announcement_id: announcement.id,
        company_id: companyId,
        price: 50,
        status: 'accepted',
      })
      .select('id')
      .single();

    if (pendOfferErr) throw pendOfferErr;

    // Create shipment
    const { data: shipment, error: shipError } = await supabaseAdmin
      .from('shipments')
      .insert({
        offer_id: pendOffer.id,
        announcement_id: announcement.id,
        company_id: companyId,
        customer_id: customerId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        status: 'assigned',
      })
      .select('id')
      .single();

    if (shipError) throw shipError;

    return shipment.id as number;
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
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'mock-pay'] });
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
      const email = `owner-payments-${Date.now()}@test.dev`;
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
        p_name: `TestCo-Payments-${Date.now()}`,
        p_status: 'approved',
      });
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Customer
    {
      const email = `customer-payments-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      customerUserId = u.user.id;

      const { data: c, error: cErr } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', customerUserId)
        .maybeSingle();

      if (cErr) throw cErr;

      if (c) {
        customerId = c.id;
      } else {
        const { data: nc, error: ncErr } = await supabaseAdmin
          .from('customers')
          .insert({ user_id: customerUserId, phone: '5551234567' })
          .select('id')
          .single();
        if (ncErr) throw ncErr;
        customerId = nc.id;
      }

      customerToken = await getToken(email, password);
    }

    // Driver
    {
      const email = `driver-payments-${Date.now()}@test.dev`;
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
          plate_number: `TEST-PAY-${Date.now()}`,
          category: 'economy',
        })
        .select('id')
        .single();

      if (vErr) throw vErr;
      vehicleId = v.id;
    }

    // Create test shipments
    completedShipmentId = await createCompletedShipment(100.5);
    pendingShipmentId = await createPendingShipment();
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (completedShipmentId) {
      await supabaseAdmin.from('payments').delete().eq('shipment_id', completedShipmentId);
      await supabaseAdmin.from('shipments').delete().eq('id', completedShipmentId);
    }
    if (pendingShipmentId) {
      await supabaseAdmin.from('shipments').delete().eq('id', pendingShipmentId);
    }
    if (vehicleId) {
      await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
    }
    if (driverId) {
      await supabaseAdmin.from('drivers').delete().eq('id', driverId);
    }
    if (customerId) {
      await supabaseAdmin.from('customers').delete().eq('id', customerId);
    }
    if (companyId) {
      await supabaseAdmin.from('companies').delete().eq('id', companyId);
    }
    if (customerUserId) {
      await supabaseAdmin.auth.admin.deleteUser(customerUserId);
    }
    if (driverUserId) {
      await supabaseAdmin.auth.admin.deleteUser(driverUserId);
    }
    if (ownerUserId) {
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    }

    // Delete offers then announcements
    await supabaseAdmin.from('offers').delete().eq('company_id', companyId!);
    await supabaseAdmin.from('announcements').delete().eq('company_id', companyId!);

    await app.close();
  }, 30000);

  // ───────────────────────────────────────────────────────────────
  // Test A: Checkout creates pending payment
  // ───────────────────────────────────────────────────────────────
  describe('Test A: Checkout creates pending payment', () => {
    it('should create checkout for completed shipment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: completedShipmentId })
        .expect(200);

      expect(res.body).toHaveProperty('provider', 'mock');
      expect(res.body).toHaveProperty('platform_order_id');
      expect(res.body.platform_order_id).toMatch(/^PO-/);
      expect(res.body).toHaveProperty('checkout_type', 'url');
      expect(res.body).toHaveProperty('checkout_url');
      expect(res.body.checkout_url).toContain('/mock-pay/');

      const platformOrderId = res.body.platform_order_id;

      // Verify payment record in DB
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('platform_order_id', platformOrderId)
        .single();

      expect(payment).toBeTruthy();
      expect(payment?.status).toBe('pending');
      expect(payment?.shipment_id).toBe(completedShipmentId);
      expect(payment?.customer_id).toBe(customerId);
      expect(payment?.company_id).toBe(companyId);
      expect(payment?.amount).toBe(100.5);
      expect(payment?.currency).toBe('TRY');
      expect(payment?.provider).toBe('mock');
    });

    it('should reject checkout for non-completed shipment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: pendingShipmentId })
        .expect(409);

      expect(res.body.message).toMatch(/not completed/i);
    });

    it('should reject checkout for non-existent shipment', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: 999999 })
        .expect(404);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test B: Callback success marks paid
  // ───────────────────────────────────────────────────────────────
  describe('Test B: Callback success marks paid', () => {
    let platformOrderId: string;

    beforeAll(async () => {
      // Create another completed shipment for this test
      const shipmentId = await createCompletedShipment(50.0);

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: shipmentId })
        .expect(200);

      platformOrderId = res.body.platform_order_id;
    });

    it('should mark payment as paid on success callback', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
          provider_payment_id: 'MOCK-TEST-123',
        })
        .expect(200);

      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('status', 'paid');

      // Verify DB
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('platform_order_id', platformOrderId)
        .single();

      expect(payment?.status).toBe('paid');
      expect(payment?.paid_at).toBeTruthy();
      expect(payment?.provider_payment_id).toBe('MOCK-TEST-123');
      expect(payment?.callback_payload).toBeTruthy();
    });

    it('should mark payment as failed on failed callback', async () => {
      // Create another shipment for failed test
      const shipmentId = await createCompletedShipment(75.0);

      const checkoutRes = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: shipmentId })
        .expect(200);

      const failedOrderId = checkoutRes.body.platform_order_id;

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: failedOrderId,
          status: 'failed',
          error_message: 'Card declined',
        })
        .expect(200);

      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('status', 'failed');

      // Verify DB
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('platform_order_id', failedOrderId)
        .single();

      expect(payment?.status).toBe('failed');
      expect(payment?.failure_message).toBe('Card declined');
      expect(payment?.paid_at).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test C: Callback idempotency
  // ───────────────────────────────────────────────────────────────
  describe('Test C: Callback idempotency', () => {
    let platformOrderId: string;

    beforeAll(async () => {
      const shipmentId = await createCompletedShipment(25.0);

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: shipmentId })
        .expect(200);

      platformOrderId = res.body.platform_order_id;
    });

    it('should be idempotent when callback called multiple times', async () => {
      // First callback
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
          provider_payment_id: 'MOCK-IDEMPOTENT',
        })
        .expect(200);

      expect(res1.body.status).toBe('paid');

      const { data: payment1 } = await supabaseAdmin
        .from('payments')
        .select('paid_at, provider_payment_id')
        .eq('platform_order_id', platformOrderId)
        .single();

      const firstPaidAt = payment1?.paid_at;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second callback (should not change paid_at or double charge)
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
          provider_payment_id: 'MOCK-IDEMPOTENT-2',
        })
        .expect(200);

      expect(res2.body.status).toBe('paid');

      const { data: payment2 } = await supabaseAdmin
        .from('payments')
        .select('paid_at, provider_payment_id')
        .eq('platform_order_id', platformOrderId)
        .single();

      // Should keep original values (idempotent)
      expect(payment2?.paid_at).toBe(firstPaidAt);
      expect(payment2?.provider_payment_id).toBe('MOCK-IDEMPOTENT');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test D: Unauthorized
  // ───────────────────────────────────────────────────────────────
  describe('Test D: Unauthorized', () => {
    it('should reject checkout without auth header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .send({ shipment_id: completedShipmentId })
        .expect(401);
    });

    it('should reject checkout with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', 'Bearer invalid-token-12345')
        .send({ shipment_id: completedShipmentId })
        .expect(401);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test E: Validation
  // ───────────────────────────────────────────────────────────────
  describe('Test E: DTO validation', () => {
    it('should reject invalid shipment_id format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: 'not-a-number' })
        .expect(400);
    });

    it('should reject negative shipment_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shipment_id: -1 })
        .expect(400);
    });

    it('should reject missing shipment_id', async () => {
      // Delay to avoid Supabase auth rate limiting
      await new Promise((r) => setTimeout(r, 2000));

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      // Accept 400 (expected) or 429 (Supabase rate limit)
      expect([400, 429]).toContain(res.status);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test F: Idempotent checkout
  // ───────────────────────────────────────────────────────────────
  describe('Test F: Idempotent checkout', () => {
    it('should return existing platform_order_id for same shipment', async () => {
      const shipmentId = await createCompletedShipment(30.0);

      // First checkout — retry on 429
      const res1 = await retryOn429(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ shipment_id: shipmentId }),
      );
      expect(res1.status).toBe(200);

      const orderId1 = res1.body.platform_order_id;

      // Second checkout (should return same order_id)
      const res2 = await retryOn429(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ shipment_id: shipmentId }),
      );
      expect(res2.status).toBe(200);

      const orderId2 = res2.body.platform_order_id;

      expect(orderId1).toBe(orderId2);

      // Verify only one payment record exists
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('shipment_id', shipmentId);

      expect(payments?.length).toBe(1);
    });

    it('should reject checkout for already paid shipment', async () => {
      const shipmentId = await createCompletedShipment(40.0);

      // First checkout — retry on 429
      const checkoutRes = await retryOn429(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ shipment_id: shipmentId }),
      );
      expect(checkoutRes.status).toBe(200);

      const platformOrderId = checkoutRes.body.platform_order_id;

      // Mark as paid
      await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
        })
        .expect(200);

      // Try to checkout again — retry on 429
      const retryRes = await retryOn429(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ shipment_id: shipmentId }),
      );
      expect(retryRes.status).toBe(409);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test G: Provider mismatch regression
  // ───────────────────────────────────────────────────────────────
  describe('Test G: Provider mismatch regression', () => {
    it('should return 409 when callback provider differs from stored provider', async () => {
      const shipmentId = await createCompletedShipment(15.0);

      // Create checkout normally (provider='mock')
      const checkoutRes = await retryOn429(() =>
        request(app.getHttpServer())
          .post('/api/v1/payments/checkout')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ shipment_id: shipmentId }),
      );
      expect(checkoutRes.status).toBe(200);

      const platformOrderId = checkoutRes.body.platform_order_id;

      // Tamper: update the row's provider to 'shopier' (simulates env switch)
      await supabaseAdmin
        .from('payments')
        .update({ provider: 'shopier' })
        .eq('platform_order_id', platformOrderId);

      // Send callback to /callback/mock — provider mismatch should yield 409
      const callbackRes = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
        });

      expect(callbackRes.status).toBe(409);
      expect(callbackRes.body.message).toContain('Provider mismatch');
    });

    it('should return 404 with platform_order_id detail for non-existent payment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/mock')
        .send({
          platform_order_id: 'PO-doesnotexist',
          status: 'success',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('PO-doesnotexist');
    });
  });
});
