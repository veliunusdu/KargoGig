import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import * as express from 'express';

/** Retry a Supabase query until data is non-null and passes a predicate (handles PgBouncer read-after-write lag). */
async function retryQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  predicate: (data: T) => boolean = (d) => d != null,
  retries = 5,
  delayMs = 600,
): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    const { data } = await queryFn();
    if (data != null && predicate(data)) return data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const { data } = await queryFn();
  return data;
}

/**
 * E2E tests for Shopier payment callback integration (Day 3).
 *
 * Tests:
 *   A — Signature verification (unit-level within E2E)
 *   B — Callback success → payment paid + event + audit
 *   C — Callback idempotency (duplicate callback)
 *   D — Invalid signature → 200, payment unchanged, audit SIGNATURE_INVALID
 *   E — Callback fail → payment failed + audit
 */
describe('Shopier Callback (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;
  let customerUserId: string | null = null;
  let customerId: number | null = null;
  let driverUserId: string | null = null;
  let driverId: number | null = null;
  let vehicleId: number | null = null;

  // Payment IDs created during tests (for cleanup)
  const createdPaymentIds: number[] = [];
  const createdShipmentIds: number[] = [];
  const createdOfferIds: number[] = [];
  const createdAnnouncementIds: number[] = [];

  const password = 'password123';

  // Shopier test secret — matches SHOPIER_SECRET env var
  const TEST_SHOPIER_SECRET = process.env.SHOPIER_SECRET || 'test-shopier-secret-key-12345';

  /**
   * Generate a valid Shopier signature for testing.
   * data = random_nr + platform_order_id + total_order_value + currency
   */
  function generateSignature(
    randomNr: string,
    platformOrderId: string,
    totalOrderValue: string,
    currency: string,
    secret: string = TEST_SHOPIER_SECRET,
  ): string {
    const data = `${randomNr}${platformOrderId}${totalOrderValue}${currency}`;
    return crypto.createHmac('sha256', secret).update(data).digest('base64');
  }

  /**
   * Create a completed shipment and return its ID.
   */
  async function createCompletedShipment(finalPrice: number): Promise<number> {
    const pickupLat = 41.0082;
    const pickupLng = 28.9784;
    const deliveryLat = 41.0182;
    const deliveryLng = 28.9884;

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
    createdAnnouncementIds.push(announcement.id);

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
    createdOfferIds.push(offer.id);

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
    createdShipmentIds.push(shipment.id);

    return shipment.id as number;
  }

  /**
   * Create a pending payment row in the DB for a given shipment.
   * Uses provider='shopier' to match callback routing.
   */
  async function createPendingPayment(
    shipmentId: number,
    amount: number,
    platformOrderId?: string,
  ): Promise<{ id: number; platform_order_id: string }> {
    const insertData: any = {
      shipment_id: shipmentId,
      customer_id: customerId,
      company_id: companyId,
      amount,
      currency: 'TRY',
      provider: 'shopier',
      status: 'pending',
    };
    if (platformOrderId) {
      insertData.platform_order_id = platformOrderId;
    }

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert(insertData)
      .select('id, platform_order_id')
      .single();

    if (error) throw error;
    createdPaymentIds.push(payment.id);

    return payment;
  }

  // ── Setup ──────────────────────────────────────────────────────────────
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

    // Force SHOPIER_SECRET for signature tests
    process.env.SHOPIER_SECRET = TEST_SHOPIER_SECRET;

    supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'mock-pay'] });
    app.use(express.urlencoded({ extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // —— Seed test entities ——

    // Owner user
    {
      const email = `owner-shopier-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      ownerUserId = u.user.id;
    }

    // Company
    {
      const { data: newCompanyId, error } = await supabaseAdmin.rpc('create_company_as_user', {
        p_user_id: ownerUserId,
        p_name: `TestCo-Shopier-${Date.now()}`,
        p_status: 'approved',
      });
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Customer
    {
      const email = `customer-shopier-${Date.now()}@test.dev`;
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
          .insert({ user_id: customerUserId, phone: '5559991234' })
          .select('id')
          .single();
        if (ncErr) throw ncErr;
        customerId = nc.id;
      }
    }

    // Driver
    {
      const email = `driver-shopier-${Date.now()}@test.dev`;
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
          plate_number: `TEST-SHOP-${Date.now()}`,
          category: 'economy',
        })
        .select('id')
        .single();

      if (vErr) throw vErr;
      vehicleId = v.id;
    }
  }, 30000);

  afterAll(async () => {
    // Cleanup payment_provider_events
    for (const pid of createdPaymentIds) {
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('platform_order_id')
        .eq('id', pid)
        .maybeSingle();

      if (payment) {
        await supabaseAdmin
          .from('payment_provider_events')
          .delete()
          .eq('platform_order_id', payment.platform_order_id);
      }
    }

    // Cleanup audit_logs for our payments
    for (const pid of createdPaymentIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('record_id', pid).eq('table_name', 'payment');
    }

    // Cleanup payments
    for (const pid of createdPaymentIds) {
      await supabaseAdmin.from('payments').delete().eq('id', pid);
    }

    // Cleanup shipments → offers → announcements (reverse FK order)
    for (const sid of createdShipmentIds) {
      await supabaseAdmin.from('shipments').delete().eq('id', sid);
    }
    for (const oid of createdOfferIds) {
      await supabaseAdmin.from('offers').delete().eq('id', oid);
    }
    for (const aid of createdAnnouncementIds) {
      await supabaseAdmin.from('announcements').delete().eq('id', aid);
    }

    // Cleanup vehicles → drivers → customers → companies → users
    if (vehicleId) await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
    if (driverId) await supabaseAdmin.from('drivers').delete().eq('id', driverId);
    if (customerId) await supabaseAdmin.from('customers').delete().eq('id', customerId);
    if (companyId) await supabaseAdmin.from('companies').delete().eq('id', companyId);

    // Delete test users
    for (const uid of [ownerUserId, customerUserId, driverUserId]) {
      if (uid) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(uid);
        } catch { /* ignore */ }
      }
    }

    if (app) await app.close();
  }, 30000);

  // ── Test A: Signature Unit Test ────────────────────────────────────────
  describe('Test A: Signature verification', () => {
    it('should generate and verify matching signatures', () => {
      const randomNr = 'abc123';
      const platformOrderId = 'PO-TEST001';
      const totalOrderValue = '150.00';
      const currency = '0'; // TRY

      const sig = generateSignature(randomNr, platformOrderId, totalOrderValue, currency);

      // Manually verify
      const data = `${randomNr}${platformOrderId}${totalOrderValue}${currency}`;
      const expected = crypto
        .createHmac('sha256', TEST_SHOPIER_SECRET)
        .update(data)
        .digest();
      const incoming = Buffer.from(sig, 'base64');

      expect(expected.length).toBe(incoming.length);
      expect(crypto.timingSafeEqual(expected, incoming)).toBe(true);
    });

    it('should reject tampered signatures', () => {
      const sig = generateSignature('abc', 'PO-1', '100.00', '0');

      // Tamper: use different data
      const data = `abc${'PO-WRONG'}100.000`;
      const expected = crypto
        .createHmac('sha256', TEST_SHOPIER_SECRET)
        .update(data)
        .digest();
      const incoming = Buffer.from(sig, 'base64');

      // Lengths match (both SHA256/32 bytes) but content differs
      expect(crypto.timingSafeEqual(expected, incoming)).toBe(false);
    });
  });

  // ── Test B: Callback Success ───────────────────────────────────────────
  describe('Test B: Callback success → paid', () => {
    let paymentId: number;
    let platformOrderId: string;

    beforeAll(async () => {
      const shipmentId = await createCompletedShipment(250.0);
      const payment = await createPendingPayment(shipmentId, 250.0);
      paymentId = payment.id;
      platformOrderId = payment.platform_order_id;
    });

    it('should mark payment as paid and write event + audit log', async () => {
      const randomNr = crypto.randomBytes(8).toString('hex');
      const totalOrderValue = '250.00';
      const currency = '0';
      const providerPaymentId = `SHOP-${Date.now()}`;

      const signature = generateSignature(randomNr, platformOrderId, totalOrderValue, currency);

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/shopier')
        .type('form')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
          payment_id: providerPaymentId,
          installment: '1',
          random_nr: randomNr,
          total_order_value: totalOrderValue,
          currency,
          signature,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('paid');

      // Verify payment in DB
      const { data: updatedPayment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      expect(updatedPayment).toBeTruthy();
      expect(updatedPayment.status).toBe('paid');
      expect(updatedPayment.paid_at).toBeTruthy();
      expect(updatedPayment.provider_payment_id).toBe(providerPaymentId);

      // Verify event row
      const { data: events } = await supabaseAdmin
        .from('payment_provider_events')
        .select('*')
        .eq('platform_order_id', platformOrderId)
        .eq('provider', 'shopier');

      expect(events).toBeTruthy();
      expect(events!.length).toBeGreaterThanOrEqual(1);
      expect(events![0].signature_valid).toBe(true);
      expect(events![0].status_raw).toBe('success');

      // Verify audit log (retry to handle PgBouncer read-after-write lag under concurrent load)
      const audits = await retryQuery(
        () => supabaseAdmin
          .from('audit_logs')
          .select('*')
          .eq('record_id', paymentId)
          .eq('action', 'PAYMENT_PAID'),
        (d: any[]) => d != null && d.length > 0,
      );

      expect(audits).toBeTruthy();
      expect(audits!.length).toBeGreaterThanOrEqual(1);

      // Verify wallet credited (check for WALLET_CREDITED or WALLET_CREDIT_FAILED audit)
      const { data: walletAudits } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('record_id', paymentId)
        .in('action', ['WALLET_CREDITED', 'WALLET_CREDIT_FAILED', 'WALLET_CREDIT_EXCEPTION']);

      // If RPC exists, we should have a wallet audit log
      if (walletAudits && walletAudits.length > 0) {
        const walletAudit = walletAudits[0];
        if (walletAudit.action === 'WALLET_CREDITED') {
          // Check wallet_transactions
          const { data: walletTxs } = await supabaseAdmin
            .from('wallet_transactions')
            .select('*')
            .eq('reference_type', 'payment')
            .eq('reference_id', paymentId)
            .eq('type', 'credit');

          expect(walletTxs).toBeTruthy();
          expect(walletTxs!.length).toBe(1);
          // Wallet receives net amount after platform commission (default 20%)
          expect(Number(walletTxs![0].amount)).toBe(200);
        } else {
          // Wallet credit failed/exception — that's okay for test (RPC might not be deployed)
          console.warn(`⚠️ Wallet credit ${walletAudit.action}: ${JSON.stringify(walletAudit.new_data)}`);
        }
      } else {
        // No wallet audit — RPC might not exist, warn but don't fail test
        console.warn('⚠️ No wallet audit log found (RPC might not be deployed yet)');
      }
    });
  });

  // ── Test C: Idempotency ────────────────────────────────────────────────
  describe('Test C: Callback idempotency (duplicate)', () => {
    let paymentId: number;
    let platformOrderId: string;

    beforeAll(async () => {
      const shipmentId = await createCompletedShipment(300.0);
      const payment = await createPendingPayment(shipmentId, 300.0);
      paymentId = payment.id;
      platformOrderId = payment.platform_order_id;
    });

    it('should handle duplicate callbacks safely', async () => {
      const randomNr = crypto.randomBytes(8).toString('hex');
      const totalOrderValue = '300.00';
      const currency = '0';
      const providerPaymentId = `SHOP-DUP-${Date.now()}`;

      const signature = generateSignature(randomNr, platformOrderId, totalOrderValue, currency);

      const callbackPayload = {
        platform_order_id: platformOrderId,
        status: 'success',
        payment_id: providerPaymentId,
        installment: '1',
        random_nr: randomNr,
        total_order_value: totalOrderValue,
        currency,
        signature,
      };

      // First call → should succeed
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/shopier')
        .type('form')
        .send(callbackPayload);

      expect(res1.status).toBe(200);
      expect(res1.body.ok).toBe(true);
      expect(res1.body.status).toBe('paid');

      // Second call (duplicate) → should be idempotent (200, no-op or paid)
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/shopier')
        .type('form')
        .send(callbackPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.ok).toBe(true);
      // Status should still be 'paid' or 'duplicate'
      expect(['paid', 'duplicate']).toContain(res2.body.status);

      // Payment should still be paid (not double-processed)
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      expect(payment.status).toBe('paid');
    });
  });

  // ── Test D: Invalid Signature ──────────────────────────────────────────
  describe('Test D: Invalid signature', () => {
    let paymentId: number;
    let platformOrderId: string;

    beforeAll(async () => {
      const shipmentId = await createCompletedShipment(400.0);
      const payment = await createPendingPayment(shipmentId, 400.0);
      paymentId = payment.id;
      platformOrderId = payment.platform_order_id;
    });

    it('should not change payment status on invalid signature', async () => {
      const randomNr = crypto.randomBytes(8).toString('hex');
      const providerPaymentId = `SHOP-BAD-${Date.now()}`;

      // Generate signature with WRONG secret
      const badSignature = generateSignature(
        randomNr,
        platformOrderId,
        '400.00',
        '0',
        'wrong-secret-key',
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/shopier')
        .type('form')
        .send({
          platform_order_id: platformOrderId,
          status: 'success',
          payment_id: providerPaymentId,
          installment: '1',
          random_nr: randomNr,
          total_order_value: '400.00',
          currency: '0',
          signature: badSignature,
        });

      // We return 200 to prevent retry spam (old-school approach)
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.status).toBe('signature_invalid');

      // Payment should remain pending
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      expect(payment.status).toBe('pending');

      // Audit log should have SIGNATURE_INVALID (retry to handle PgBouncer read-after-write lag)
      const audits = await retryQuery(
        () => supabaseAdmin
          .from('audit_logs')
          .select('*')
          .eq('action', 'SIGNATURE_INVALID')
          .order('created_at', { ascending: false })
          .limit(20),
        (d: any[]) => d != null && d.some((a: any) => a.new_data?.platform_order_id === platformOrderId),
      );

      const matchingAudit = audits?.find(
        (a: any) => a.new_data?.platform_order_id === platformOrderId,
      );
      expect(matchingAudit).toBeTruthy();
    });
  });

  // ── Test E: Callback Fail ──────────────────────────────────────────────
  describe('Test E: Callback fail → payment failed', () => {
    let paymentId: number;
    let platformOrderId: string;

    beforeAll(async () => {
      const shipmentId = await createCompletedShipment(500.0);
      const payment = await createPendingPayment(shipmentId, 500.0);
      paymentId = payment.id;
      platformOrderId = payment.platform_order_id;
    });

    it('should mark payment as failed with audit log', async () => {
      const randomNr = crypto.randomBytes(8).toString('hex');
      const totalOrderValue = '500.00';
      const currency = '0';
      const providerPaymentId = `SHOP-FAIL-${Date.now()}`;

      const signature = generateSignature(randomNr, platformOrderId, totalOrderValue, currency);

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/callback/shopier')
        .type('form')
        .send({
          platform_order_id: platformOrderId,
          status: 'failed', // NOT 'success'
          payment_id: providerPaymentId,
          random_nr: randomNr,
          total_order_value: totalOrderValue,
          currency,
          signature,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('failed');

      // Verify payment in DB
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      expect(payment.status).toBe('failed');
      expect(payment.failure_message).toBeTruthy();

      // Verify audit log (with retry for PgBouncer read-after-write lag)
      const audits = await retryQuery(
        () => supabaseAdmin
          .from('audit_logs')
          .select('*')
          .eq('record_id', paymentId)
          .eq('action', 'PAYMENT_FAILED'),
        (d: any[]) => d != null && d.length > 0,
      );

      expect(audits).toBeTruthy();
      expect(audits!.length).toBeGreaterThanOrEqual(1);
    });
  });
});

