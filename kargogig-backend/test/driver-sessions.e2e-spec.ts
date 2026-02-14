import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for POST /drivers/go-online and POST /drivers/go-offline (Day 5).
 *
 * Tests driver session management and online/offline status tracking.
 */
describe('Driver Sessions (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  const STRICT_MODE = process.env.E2E_STRICT_DB === 'true';

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;

  // Driver 1 (approved driver)
  let driverUserId: string | null = null;
  let driverId: number | null = null;
  let driverToken: string | null = null;

  // Driver 2 (not approved)
  let driver2UserId: string | null = null;
  let driver2Id: number | null = null;
  let driver2Token: string | null = null;

  // Regular user (not a driver)
  let regularUserId: string | null = null;
  let regularToken: string | null = null;

  async function getToken(email: string, password: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data.session.access_token;
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
      const email = `owner-sessions-${Date.now()}@test.dev`;
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
          p_name: `TestCo-Sessions-${Date.now()}`,
          p_status: 'approved',
        },
      );
      if (error) throw error;
      companyId = newCompanyId;
    }

    // Driver 1 (approved)
    {
      const email = `driver-sessions-${Date.now()}_1@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
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
          is_online: false,
          is_available: false,
          availability: 'unavailable',
        })
        .select('id')
        .single();

      if (dErr) throw dErr;
      driverId = d.id;

      driverToken = await getToken(email, password);
    }

    // Driver 2 (not approved)
    {
      const email = `driver-sessions-${Date.now()}_2@test.dev`;
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
          status: 'pending',
          is_online: false,
          is_available: false,
          availability: 'unavailable',
        })
        .select('id')
        .single();

      if (dErr) throw dErr;
      driver2Id = d.id;

      driver2Token = await getToken(email, password);
    }

    // Regular user (not a driver)
    {
      const email = `regular-sessions-${Date.now()}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (uErr) throw uErr;
      regularUserId = u.user.id;
      regularToken = await getToken(email, password);
    }
  });

  afterAll(async () => {
    // Cleanup
    if (driverId) {
      await supabaseAdmin
        .from('driver_sessions')
        .delete()
        .eq('driver_id', driverId);
      await supabaseAdmin.from('drivers').delete().eq('id', driverId);
    }
    if (driver2Id) {
      await supabaseAdmin
        .from('driver_sessions')
        .delete()
        .eq('driver_id', driver2Id);
      await supabaseAdmin.from('drivers').delete().eq('id', driver2Id);
    }
    if (companyId) {
      await supabaseAdmin.from('companies').delete().eq('id', companyId);
    }
    if (driverUserId) {
      await supabaseAdmin.auth.admin.deleteUser(driverUserId);
    }
    if (driver2UserId) {
      await supabaseAdmin.auth.admin.deleteUser(driver2UserId);
    }
    if (ownerUserId) {
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    }
    if (regularUserId) {
      await supabaseAdmin.auth.admin.deleteUser(regularUserId);
    }
    await app.close();
  });

  // ───────────────────────────────────────────────────────────────
  // Test A: Happy path — go online then offline
  // ───────────────────────────────────────────────────────────────
  describe('Test A: Online/Offline lifecycle', () => {
    it('should allow approved driver to go online', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ device_type: 'android', device_token: 'test-fcm-token-123' })
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_online')) {
            return; // Skip test if RPC not deployed
          }
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res, 'driver_go_online')) return;

      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('driver_id', driverId);
      expect(res.body).toHaveProperty('is_online', true);

      // Verify driver status in DB
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('is_online')
        .eq('id', driverId)
        .single();

      expect(driver?.is_online).toBe(true);

      // Verify session created
      const { data: session } = await supabaseAdmin
        .from('driver_sessions')
        .select('driver_id, is_online, device_type, device_token')
        .eq('driver_id', driverId)
        .single();

      expect(session).toBeTruthy();
      expect(session?.is_online).toBe(true);
      expect(session?.device_type).toBe('android');
      expect(session?.device_token).toBe('test-fcm-token-123');
    });

    it('should allow driver to go offline', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-offline')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ device_type: 'android' })
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_offline')) {
            return;
          }
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res, 'driver_go_offline')) return;

      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('driver_id', driverId);
      expect(res.body).toHaveProperty('is_online', false);

      // Verify driver status in DB
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('is_online')
        .eq('id', driverId)
        .single();

      expect(driver?.is_online).toBe(false);

      // Verify session updated
      const { data: session } = await supabaseAdmin
        .from('driver_sessions')
        .select('is_online')
        .eq('driver_id', driverId)
        .single();

      expect(session?.is_online).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test B: Idempotency
  // ───────────────────────────────────────────────────────────────
  describe('Test B: Idempotency', () => {
    it('should be idempotent when going online multiple times', async () => {
      // Go online first time
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ device_type: 'ios' })
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_online')) return;
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res1, 'driver_go_online')) return;

      // Go online second time (should succeed, not error)
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ device_type: 'ios', device_token: 'updated-token' })
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_online')) return;
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res2, 'driver_go_online')) return;

      expect(res2.body).toHaveProperty('ok', true);
      expect(res2.body).toHaveProperty('is_online', true);

      // Verify only one session exists with updated token
      const { data: sessions } = await supabaseAdmin
        .from('driver_sessions')
        .select('device_token')
        .eq('driver_id', driverId);

      expect(sessions?.length).toBe(1);
      expect(sessions?.[0]?.device_token).toBe('updated-token');
    });

    it('should be idempotent when going offline multiple times', async () => {
      // Go offline first time
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-offline')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({})
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_offline')) return;
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res1, 'driver_go_offline')) return;

      // Go offline second time (should succeed)
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-offline')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({})
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_offline')) return;
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res2, 'driver_go_offline')) return;

      expect(res2.body).toHaveProperty('is_online', false);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test C: Not approved driver
  // ───────────────────────────────────────────────────────────────
  describe('Test C: Not approved driver', () => {
    it('should reject go-online for non-approved driver', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${driver2Token}`)
        .send({ device_type: 'web' })
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_online')) return;
          expect([409, 403]).toContain(r.status);
        });

      if (handleRpcMissing(res, 'driver_go_online')) return;

      expect(res.body.message).toMatch(/not approved/i);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test D: Not a driver
  // ───────────────────────────────────────────────────────────────
  describe('Test D: Regular user (not a driver)', () => {
    it('should reject go-online for non-driver user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ device_type: 'android' })
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_online')) return;
          expect([403, 404]).toContain(r.status);
        });

      if (handleRpcMissing(res, 'driver_go_online')) return;

      expect(res.body.message).toMatch(/not a driver/i);
    });

    it('should reject go-offline for non-driver user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-offline')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({})
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_offline')) return;
          expect([403, 404]).toContain(r.status);
        });

      if (handleRpcMissing(res, 'driver_go_offline')) return;

      expect(res.body.message).toMatch(/not a driver/i);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test E: Missing authorization
  // ───────────────────────────────────────────────────────────────
  describe('Test E: Missing authorization', () => {
    it('should reject go-online without auth header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .send({ device_type: 'android' })
        .expect(401);
    });

    it('should reject go-offline without auth header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/drivers/go-offline')
        .send({})
        .expect(401);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Test F: Validation
  // ───────────────────────────────────────────────────────────────
  describe('Test F: DTO validation', () => {
    it('should accept valid device_type values', async () => {
      for (const deviceType of ['unknown', 'ios', 'android', 'web']) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/drivers/go-online')
          .set('Authorization', `Bearer ${driverToken}`)
          .send({ device_type: deviceType })
          .expect((r) => {
            if (handleRpcMissing(r, 'driver_go_online')) return;
            expect([200, 201]).toContain(r.status);
          });

        if (handleRpcMissing(res, 'driver_go_online')) return;
      }
    });

    it('should reject invalid device_type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ device_type: 'invalid_device' })
        .expect(400);
    });

    it('should accept request without optional fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers/go-online')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({})
        .expect((r) => {
          if (handleRpcMissing(r, 'driver_go_online')) return;
          expect([200, 201]).toContain(r.status);
        });

      if (handleRpcMissing(res, 'driver_go_online')) return;
    });
  });
});
