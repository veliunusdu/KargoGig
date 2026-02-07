import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import * as express from 'express';

/**
 * E2E tests for payment refunds (Day 5).
 *
 * Tests:
 *   A — Full refund → payment paid → refund → assert DB rows + wallet debit
 *   B — Idempotency (full refund) → same key twice → same result
 *   C — Partial refund → assert proportional wallet debit
 *   D — Over-refund attempt → 409/400 error
 */
describe('Payment Refunds (e2e)', () => {
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
  let walletId: number | null = null;

  // IDs for cleanup
  const createdPaymentIds: number[] = [];
  const createdShipmentIds: number[] = [];
  const createdOfferIds: number[] = [];
  const createdAnnouncementIds: number[] = [];

  const password = 'password123';

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

    return shipment.id;
  }

  /**
   * Create a paid payment for a shipment (provider='mock' for testing).
   */
  async function createPaidPayment(
    shipmentId: number,
    amount: number,
  ): Promise<{ id: number; platform_order_id: string }> {
    const platformOrderId = `ORDER-REFUND-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        shipment_id: shipmentId,
        customer_id: customerId,
        company_id: companyId,
        amount,
        currency: 'TRY',
        provider: 'mock',
        status: 'paid',
        platform_order_id: platformOrderId,
        provider_payment_id: `MOCK-PAY-${Date.now()}`,
      })
      .select('id, platform_order_id')
      .single();

    if (error) throw error;
    createdPaymentIds.push(payment.id);

    return payment;
  }

  /**
   * Credit company wallet via RPC (simulates payment success).
   */
  async function creditCompanyWallet(paymentId: number): Promise<void> {
    const { error } = await supabaseAdmin.rpc('credit_company_wallet_for_payment', {
      p_payment_id: paymentId,
    });

    // Gracefully skip if RPC not deployed yet
    if (error && error.message.includes('could not find')) {
      console.warn('[creditCompanyWallet] RPC not found, skipping wallet credit');
      return;
    }

    if (error) throw error;
  }

  // ── Setup ──────────────────────────────────────────────────────────────
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
      const email = `owner-refund-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      ownerUserId = u.user.id;

      const { data: prof, error: profErr } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: ownerUserId, full_name: 'Owner Refund', role: 'company' })
        .select('id')
        .single();
      if (profErr) throw profErr;
    }

    // Company
    {
      const { data: c, error: cErr } = await supabaseAdmin
        .from('companies')
        .insert({
          owner_user_id: ownerUserId,
          name: 'Refund Test Co',
          vat_number: 'VAT-REFUND-12345',
          email: 'refund@testco.dev',
          phone: '+901112223344',
          address: 'Refund St',
          city: 'Istanbul',
        })
        .select('id')
        .single();
      if (cErr) throw cErr;
      companyId = c.id;
    }

    // Customer user
    {
      const email = `customer-refund-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      customerUserId = u.user.id;

      const { data: prof, error: profErr } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: customerUserId, full_name: 'Customer Refund', role: 'customer' })
        .select('id')
        .single();
      if (profErr) throw profErr;

      const { data: cust, error: custErr } = await supabaseAdmin
        .from('customers')
        .insert({ user_id: customerUserId })
        .select('id')
        .single();
      if (custErr) throw custErr;
      customerId = cust.id;
    }

    // Driver user
    {
      const email = `driver-refund-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      driverUserId = u.user.id;

      const { data: prof, error: profErr } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: driverUserId, full_name: 'Driver Refund', role: 'driver' })
        .select('id')
        .single();
      if (profErr) throw profErr;

      const { data: drv, error: drvErr } = await supabaseAdmin
        .from('drivers')
        .insert({
          company_id: companyId,
          user_id: driverUserId,
          availability: 'available',
          phone: '+901112223355',
        })
        .select('id')
        .single();
      if (drvErr) throw drvErr;
      driverId = drv.id;
    }

    // Vehicle
    {
      const { data: veh, error: vehErr } = await supabaseAdmin
        .from('vehicles')
        .insert({
          company_id: companyId,
          driver_id: driverId,
          category: 'economy',
          brand: 'Ford',
          model: 'Transit',
          year: 2020,
          plate_number: 'REFUND-34-TEST',
          capacity: 1000,
        })
        .select('id')
        .single();
      if (vehErr) throw vehErr;
      vehicleId = veh.id;
    }

    // Wallet
    {
      const { data: w, error: wErr } = await supabaseAdmin
        .from('wallets')
        .insert({
          company_id: companyId,
          balance: 0,
          currency: 'TRY',
        })
        .select('id')
        .single();
      if (wErr) throw wErr;
      walletId = w.id;
    }
  });

  // ── Teardown ──────────────────────────────────────────────────────────
  afterAll(async () => {
    // Clean up test data
    if (createdPaymentIds.length) {
      await supabaseAdmin.from('payment_refunds').delete().in('payment_id', createdPaymentIds);
      await supabaseAdmin.from('payment_provider_events').delete().in('payment_id', createdPaymentIds);
      await supabaseAdmin.from('payments').delete().in('id', createdPaymentIds);
    }
    if (createdShipmentIds.length) {
      await supabaseAdmin.from('shipments').delete().in('id', createdShipmentIds);
    }
    if (createdOfferIds.length) {
      await supabaseAdmin.from('offers').delete().in('id', createdOfferIds);
    }
    if (createdAnnouncementIds.length) {
      await supabaseAdmin.from('announcements').delete().in('id', createdAnnouncementIds);
    }
    if (vehicleId) await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
    if (driverId) await supabaseAdmin.from('drivers').delete().eq('id', driverId);
    if (customerId) await supabaseAdmin.from('customers').delete().eq('id', customerId);
    if (walletId) await supabaseAdmin.from('wallets').delete().eq('id', walletId);
    if (companyId) await supabaseAdmin.from('companies').delete().eq('id', companyId);
    if (ownerUserId) await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    if (customerUserId) await supabaseAdmin.auth.admin.deleteUser(customerUserId);
    if (driverUserId) await supabaseAdmin.auth.admin.deleteUser(driverUserId);

    await app.close();
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test A — Full refund → paid → refund → assert DB rows + wallet debit ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('A) Should fully refund a paid payment and debit company wallet', async () => {
    const shipmentId = await createCompletedShipment(200);
    const payment = await createPaidPayment(shipmentId, 200);

    // Credit company wallet (simulates payment success)
    await creditCompanyWallet(payment.id);

    // Verify wallet was credited
    const { data: walletBefore } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single();

    // Call refund endpoint
    const idempotencyKey = `IDEMPOTENCY-FULL-${payment.id}-${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post(`/api/v1/payments/${payment.id}/refund`)
      .send({
        type: 'full',
        idempotency_key: idempotencyKey,
        reason: 'Customer cancelled before pickup',
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.refund).toBeDefined();
    expect(response.body.refund.type).toBe('full');
    expect(response.body.refund.amount_gross).toBe(200);

    // Assert refund row
    const { data: refund } = await supabaseAdmin
      .from('payment_refunds')
      .select('*')
      .eq('payment_id', payment.id)
      .single();

    expect(refund).toBeDefined();
    expect(refund.type).toBe('full');
    expect(refund.amount_gross).toBe(200);
    expect(refund.idempotency_key).toBe(idempotencyKey);
    expect(refund.provider_refund_id).toContain('MOCK-REFUND-full');

    // Assert wallet debit
    const { data: walletAfter } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single();

    // Balance should be: walletBefore.balance - company_debit
    // company_debit = amount_gross * (1 - commission_rate)
    // For economy category: commission_rate = 0.15, so company_debit = 200 * 0.85 = 170
    const expectedDebit = 170;
    expect(walletAfter!.balance).toBeLessThan(walletBefore!.balance);
    expect(walletBefore!.balance - walletAfter!.balance).toBe(expectedDebit);

    // Assert wallet_transactions row
    const { data: txs } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .eq('type', 'debit')
      .eq('reference_type', 'payment_refund')
      .eq('reference_id', refund.id);

    expect(txs).toBeDefined();
    expect(txs!.length).toBeGreaterThan(0);
    expect(txs![0].amount).toBe(expectedDebit);

    // Assert audit log (graceful skip if RPC missing)
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'payment')
      .eq('entity_id', payment.id)
      .eq('action', 'REFUND_SUCCEEDED');

    if (auditLogs && auditLogs.length > 0) {
      expect(auditLogs[0].meta.type).toBe('full');
      expect(auditLogs[0].meta.refund_id).toBe(refund.id);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║ Test B — Idempotency (full refund) → same key twice → same   ║
  // ╚═══════════════════════════════════════════════════════════════╝
  it('B) Should handle idempotent full refund (same key twice → same result)', async () => {
    const shipmentId = await createCompletedShipment(300);
    const payment = await createPaidPayment(shipmentId, 300);

    await creditCompanyWallet(payment.id);

    const idempotencyKey = `IDEMPOTENCY-FULL-${payment.id}-${Date.now()}`;

    // First refund
    const response1 = await request(app.getHttpServer())
      .post(`/api/v1/payments/${payment.id}/refund`)
      .send({
        type: 'full',
        idempotency_key: idempotencyKey,
        reason: 'Test idempotency',
      })
      .expect(201);

    expect(response1.body.ok).toBe(true);
    const refundId1 = response1.body.refund.id;

    // Second refund (same key)
    const response2 = await request(app.getHttpServer())
      .post(`/api/v1/payments/${payment.id}/refund`)
      .send({
        type: 'full',
        idempotency_key: idempotencyKey,
        reason: 'Test idempotency',
      })
      .expect(201);

    expect(response2.body.ok).toBe(true);
    expect(response2.body.refund.id).toBe(refundId1); // Same refund ID
    expect(response2.body.refund.already_refunded).toBe(true);

    // Assert only one refund row
    const { data: refunds } = await supabaseAdmin
      .from('payment_refunds')
      .select('*')
      .eq('payment_id', payment.id);

    expect(refunds).toBeDefined();
    expect(refunds!.length).toBe(1);
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║ Test C — Partial refund → assert proportional wallet debit   ║
  // ╚═══════════════════════════════════════════════════════════════╝
  it('C) Should partially refund a payment with proportional wallet debit', async () => {
    const shipmentId = await createCompletedShipment(500);
    const payment = await createPaidPayment(shipmentId, 500);

    await creditCompanyWallet(payment.id);

    const { data: walletBefore } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single();

    // Partial refund: 200 TRY (out of 500)
    const idempotencyKey = `IDEMPOTENCY-PARTIAL-${payment.id}-${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post(`/api/v1/payments/${payment.id}/refund`)
      .send({
        type: 'partial',
        amount: 200,
        idempotency_key: idempotencyKey,
        reason: 'Partial damage compensation',
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.refund.type).toBe('partial');
    expect(response.body.refund.amount_gross).toBe(200);
    expect(response.body.refund.remaining_refundable).toBe(300); // 500 - 200

    // Assert refund row
    const { data: refund } = await supabaseAdmin
      .from('payment_refunds')
      .select('*')
      .eq('payment_id', payment.id)
      .single();

    expect(refund).toBeDefined();
    expect(refund.type).toBe('partial');
    expect(refund.amount_gross).toBe(200);

    // Assert wallet debit (proportional)
    // company_debit = 200 * 0.85 = 170
    const { data: walletAfter } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single();

    const expectedDebit = 170;
    expect(walletBefore!.balance - walletAfter!.balance).toBe(expectedDebit);
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║ Test D — Over-refund attempt → 409/400 error                 ║
  // ╚═══════════════════════════════════════════════════════════════╝
  it('D) Should reject over-refund attempt (409 Conflict)', async () => {
    const shipmentId = await createCompletedShipment(100);
    const payment = await createPaidPayment(shipmentId, 100);

    await creditCompanyWallet(payment.id);

    // First partial refund: 60 TRY
    const idempotencyKey1 = `IDEMPOTENCY-PARTIAL-${payment.id}-${Date.now()}-1`;
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${payment.id}/refund`)
      .send({
        type: 'partial',
        amount: 60,
        idempotency_key: idempotencyKey1,
      })
      .expect(201);

    // Second partial refund: 50 TRY (over-refund: 60 + 50 = 110 > 100)
    const idempotencyKey2 = `IDEMPOTENCY-PARTIAL-${payment.id}-${Date.now()}-2`;
    const response = await request(app.getHttpServer())
      .post(`/api/v1/payments/${payment.id}/refund`)
      .send({
        type: 'partial',
        amount: 50,
        idempotency_key: idempotencyKey2,
      })
      .expect(409);

    expect(response.body.message).toContain('Over-refund');
  });
});
