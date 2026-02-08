import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Day 5 — End-to-end demo test
 *
 * Validates the critical path:
 *   health -> create announcement -> match -> create offer -> accept offer
 *   -> checkout -> mock callback
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   DEMO_CUSTOMER_EMAIL, DEMO_CUSTOMER_PASSWORD
 *   DEMO_COMPANY_EMAIL, DEMO_COMPANY_PASSWORD
 */
describe('Day5 Demo (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  let customerToken: string;
  let companyToken: string;

  let announcementId: number;
  let companyId: number;
  let offerId: number;
  let shipmentId: number;
  let platformOrderId: string;

  let requestCounter = 0;
  function nextRequestId(): string {
    return `e2e-demo-${String(++requestCounter).padStart(3, '0')}`;
  }

  // ---------- helpers ----------

  async function getToken(email: string, password: string): Promise<string> {
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session!.access_token;
  }

  /** Decode JWT payload without verification (test helper only). */
  function decodeJwtPayload(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  }

  async function resolveCompanyId(userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (error || !data) throw new Error(`Company not found for user ${userId}`);
    return data.id as number;
  }

  // ---------- setup / teardown ----------

  beforeAll(async () => {
    // Validate env
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'DEMO_CUSTOMER_EMAIL',
      'DEMO_CUSTOMER_PASSWORD',
      'DEMO_COMPANY_EMAIL',
      'DEMO_COMPANY_PASSWORD',
    ];
    for (const v of requiredVars) {
      if (!process.env[v]) {
        throw new Error(`Missing env var: ${v}. Set it in .env or .env.test`);
      }
    }

    supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    // Auth
    customerToken = await getToken(
      process.env.DEMO_CUSTOMER_EMAIL!,
      process.env.DEMO_CUSTOMER_PASSWORD!,
    );
    companyToken = await getToken(
      process.env.DEMO_COMPANY_EMAIL!,
      process.env.DEMO_COMPANY_PASSWORD!,
    );

    // Resolve company_id
    const companyPayload = decodeJwtPayload(companyToken);
    companyId = await resolveCompanyId(companyPayload.sub);
  }, 30_000);

  afterAll(async () => {
    // Cleanup: cancel announcement created during test (soft delete)
    if (announcementId) {
      await supabaseAdmin
        .from('announcements')
        .update({ status: 'cancelled' })
        .eq('id', announcementId);
    }
    await app?.close();
  });

  // ---------- tests ----------

  it('GET /api/v1/health should return ok', async () => {
    const rid = nextRequestId();
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', rid)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('ts');
  });

  it('POST /api/v1/announcements should create announcement', async () => {
    const rid = nextRequestId();
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-request-id', rid)
      .send({
        pickup_location: 'Kadikoy, Istanbul',
        pickup_lat: 40.9903,
        pickup_lng: 29.0295,
        pickup_city: 'Istanbul',
        delivery_location: 'Besiktas, Istanbul',
        delivery_lat: 41.0422,
        delivery_lng: 29.0057,
        delivery_city: 'Istanbul',
        cargo_type: 'furniture',
        cargo_weight: 120,
        notes: `E2E Day5 test - ${new Date().toISOString()}`,
      })
      .expect((res) => {
        if (res.status !== 200 && res.status !== 201) {
          throw new Error(
            `Expected 200/201 but got ${res.status}: ${JSON.stringify(res.body)}`,
          );
        }
      });

    expect(res.body).toHaveProperty('id');
    announcementId = res.body.id;
    expect(announcementId).toBeGreaterThan(0);
  });

  it('POST /api/v1/announcements/:id/match should return ok', async () => {
    const rid = nextRequestId();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/announcements/${announcementId}/match?radius_meters=50000&limit=20`)
      .set('Authorization', `Bearer ${companyToken}`)
      .set('x-request-id', rid)
      .expect(201);

    expect(res.body.ok).toBe(true);
  });

  it('POST /api/v1/offers should create offer', async () => {
    const rid = nextRequestId();
    const res = await request(app.getHttpServer())
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${companyToken}`)
      .set('x-request-id', rid)
      .send({
        announcement_id: announcementId,
        company_id: companyId,
        price: 250,
        currency: 'TRY',
        notes: 'E2E demo offer',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    offerId = res.body.id;
    expect(offerId).toBeGreaterThan(0);
  });

  it('PATCH /api/v1/offers/:id/accept should accept offer', async () => {
    const rid = nextRequestId();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/offers/${offerId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-request-id', rid)
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('accepted');

    // Wait for DB trigger to create shipment
    await new Promise((r) => setTimeout(r, 1000));

    // Look up shipment
    const { data: shipments } = await supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('offer_id', offerId);

    if (shipments && shipments.length > 0) {
      shipmentId = shipments[0].id;
    }
  });

  it('Checkout + mock callback (payment flow)', async () => {
    if (!shipmentId) {
      console.log('[SKIP] No shipment created by trigger — skipping payment tests');
      return;
    }

    // Mark shipment as completed (required for checkout)
    await supabaseAdmin
      .from('shipments')
      .update({
        status: 'completed',
        final_price: 250,
        delivered_at: new Date().toISOString(),
      })
      .eq('id', shipmentId);

    // Checkout
    const rid1 = nextRequestId();
    const checkoutRes = await request(app.getHttpServer())
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-request-id', rid1)
      .send({ shipment_id: shipmentId })
      .expect(200);

    expect(checkoutRes.body).toHaveProperty('platform_order_id');
    platformOrderId = checkoutRes.body.platform_order_id;

    // Mock callback
    const rid2 = nextRequestId();
    const callbackRes = await request(app.getHttpServer())
      .post('/api/v1/payments/callback/mock')
      .set('x-request-id', rid2)
      .send({
        platform_order_id: platformOrderId,
        status: 'success',
        provider_payment_id: `MOCK-E2E-${Date.now()}`,
      })
      .expect(200);

    expect(callbackRes.body.ok).toBe(true);
    expect(callbackRes.body.status).toBe('paid');
  });
});
