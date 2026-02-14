import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function supaAuthed(url: string, anonKey: string, jwt: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

describe('Day 5 — Security Pass (RLS) интеграцион тест', () => {
  const SUPABASE_URL = mustEnv('SUPABASE_URL');
  const SUPABASE_ANON_KEY = mustEnv('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = mustEnv('SUPABASE_SERVICE_ROLE_KEY');
  const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!DB_URL)
    throw new Error('Missing env: SUPABASE_DB_URL (or DATABASE_URL)');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  // ids we create
  const created: any = {
    users: [] as string[],
    companyId: null as number | null,
    driverA: { userId: '', driverId: 0, email: '', jwt: '' },
    driverB: { userId: '', driverId: 0, email: '', jwt: '' },
    customer: { userId: '', customerId: 0, email: '', jwt: '' },
    adminUser: { userId: '', email: '', jwt: '' },
    docAId: 0,
    docBId: 0,
    notifAId: 0,
    notifBId: 0,
    announcementId: 0,
    offerId: 0,
    shipmentId: 0,
  };

  async function createUser(email: string, password: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    if (!data.user) throw new Error('No user returned');
    created.users.push(data.user.id);
    return data.user.id;
  }

  async function signIn(email: string, password: string) {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.session?.access_token) throw new Error('No access_token');
    return data.session.access_token;
  }

  beforeAll(async () => {
    const stamp = Date.now();
    const password = 'TestPass123!';

    // 1) Create auth users
    created.driverA.email = `e2e-driver-a-${stamp}@test.dev`;
    created.driverB.email = `e2e-driver-b-${stamp}@test.dev`;
    created.customer.email = `e2e-customer-${stamp}@test.dev`;
    created.adminUser.email = `e2e-admin-${stamp}@test.dev`;

    created.driverA.userId = await createUser(created.driverA.email, password);
    created.driverB.userId = await createUser(created.driverB.email, password);
    created.customer.userId = await createUser(
      created.customer.email,
      password,
    );
    created.adminUser.userId = await createUser(
      created.adminUser.email,
      password,
    );

    // 2) Get JWTs (for RLS)
    created.driverA.jwt = await signIn(created.driverA.email, password);
    created.driverB.jwt = await signIn(created.driverB.email, password);
    created.customer.jwt = await signIn(created.customer.email, password);
    created.adminUser.jwt = await signIn(created.adminUser.email, password);

    // 3) Seed DB (SQL) — company, customer, drivers, docs, notifications, delivered shipment chain
    const client = await pool.connect();
    try {
      await client.query('begin');

      // 🔑 Provide auth.uid() context for triggers (e.g., companies -> company_users)
      await client.query(
        `select set_config('request.jwt.claim.sub', $1, true);`,
        [created.adminUser.userId],
      );
      await client.query(
        `select set_config('request.jwt.claim.role', 'authenticated', true);`,
      );

      // 🧹 Clean up any orphaned test data from interrupted previous runs
      await client.query(
        `delete from public.customers where user_id in ($1::uuid, $2::uuid, $3::uuid, $4::uuid);`,
        [
          created.driverA.userId,
          created.driverB.userId,
          created.customer.userId,
          created.adminUser.userId,
        ],
      );
      await client.query(
        `delete from public.drivers where user_id in ($1::uuid, $2::uuid, $3::uuid, $4::uuid);`,
        [
          created.driverA.userId,
          created.driverB.userId,
          created.customer.userId,
          created.adminUser.userId,
        ],
      );

      // roles/admin assignment (used by is_admin())
      await client.query(
        `insert into public.roles(name) values ('admin') on conflict (name) do nothing;`,
      );
      const roleRes = await client.query(
        `select id from public.roles where name='admin' limit 1;`,
      );
      const adminRoleId = roleRes.rows[0].id;

      await client.query(
        `insert into public.user_role_assignments(user_id, role_id)
         values ($1::uuid, $2)
         on conflict do nothing;`,
        [created.adminUser.userId, adminRoleId],
      );

      // company
      const compRes = await client.query(
        `insert into public.companies(name, status)
         values ($1, 'approved')
         returning id;`,
        [`E2E Company ${stamp}`],
      );
      created.companyId = Number(compRes.rows[0].id);

      // customer row
      const custRes = await client.query(
        `insert into public.customers(user_id)
         values ($1::uuid)
         returning id;`,
        [created.customer.userId],
      );
      created.customer.customerId = Number(custRes.rows[0].id);

      // drivers rows
      const dARes = await client.query(
        `insert into public.drivers(user_id, company_id, status, is_online, is_available)
         values ($1::uuid, $2, 'approved', true, true)
         returning id;`,
        [created.driverA.userId, created.companyId],
      );
      created.driverA.driverId = Number(dARes.rows[0].id);

      const dBRes = await client.query(
        `insert into public.drivers(user_id, company_id, status, is_online, is_available)
         values ($1::uuid, $2, 'approved', true, true)
         returning id;`,
        [created.driverB.userId, created.companyId],
      );
      created.driverB.driverId = Number(dBRes.rows[0].id);

      // documents (pending)
      const docARes = await client.query(
        `insert into public.documents(owner_type, owner_id, document_type, file_url, status, expires_at)
         values ('driver', $1, 'driver_license', 'test://a.pdf', 'pending'::public.document_status, current_date + 30)
         returning id;`,
        [created.driverA.driverId],
      );
      created.docAId = Number(docARes.rows[0].id);

      const docBRes = await client.query(
        `insert into public.documents(owner_type, owner_id, document_type, file_url, status, expires_at)
         values ('driver', $1, 'driver_license', 'test://b.pdf', 'pending'::public.document_status, current_date + 30)
         returning id;`,
        [created.driverB.driverId],
      );
      created.docBId = Number(docBRes.rows[0].id);

      // notifications
      const nARes = await client.query(
        `insert into public.notifications(user_id, title, body, type)
         values ($1::uuid, 'E2E A', 'Hello A', 'test')
         returning id;`,
        [created.driverA.userId],
      );
      created.notifAId = Number(nARes.rows[0].id);

      const nBRes = await client.query(
        `insert into public.notifications(user_id, title, body, type)
         values ($1::uuid, 'E2E B', 'Hello B', 'test')
         returning id;`,
        [created.driverB.userId],
      );
      created.notifBId = nBRes.rows[0].id;

      // delivered shipment chain for driver_ratings policy test
      // announcements needs PostGIS point (using GEOGRAPHY from text – usually safest in Supabase)
      const annRes = await client.query(
        `insert into public.announcements(
            customer_id,
            company_id,
            pickup_location,
            pickup_point,
            delivery_location,
            delivery_point,
            cargo_type
          )
          values (
            $1,
            $2,
            'Test Pickup',
            ST_GeogFromText('POINT(28.9784 41.0082)'),
            'Test Dropoff',
            ST_GeogFromText('POINT(28.99 41.01)'),
            'box'
          )
          returning id;`,
        [created.customer.customerId, created.companyId],
      );
      created.announcementId = Number(annRes.rows[0].id);

      const offerRes = await client.query(
        `insert into public.offers(announcement_id, company_id, driver_id, price, currency, status)
         values ($1, $2, $3, 100, 'TRY', 'accepted'::public.offer_status)
         returning id;`,
        [created.announcementId, created.companyId, created.driverA.driverId],
      );
      created.offerId = Number(offerRes.rows[0].id);

      const shipRes = await client.query(
        `insert into public.shipments(
           offer_id, announcement_id, customer_id, company_id, driver_id,
           status, delivered_at
         )
         values ($1, $2, $3, $4, $5,
           'delivered'::public.shipment_status, now()
         )
         returning id;`,
        [
          created.offerId,
          created.announcementId,
          created.customer.customerId,
          created.companyId,
          created.driverA.driverId,
        ],
      );
      created.shipmentId = Number(shipRes.rows[0].id);

      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // cleanup db rows (reverse FK order)
    const client = await pool.connect();
    try {
      await client.query('begin');

      // 🔑 Provide auth.uid() context for cleanup triggers/audit
      await client.query(
        `select set_config('request.jwt.claim.sub', $1, true);`,
        [created.adminUser.userId],
      );
      await client.query(
        `select set_config('request.jwt.claim.role', 'authenticated', true);`,
      );

      await client.query(
        `delete from public.driver_ratings where shipment_id = $1;`,
        [created.shipmentId],
      );
      await client.query(`delete from public.shipments where id = $1;`, [
        created.shipmentId,
      ]);
      await client.query(`delete from public.offers where id = $1;`, [
        created.offerId,
      ]);
      await client.query(`delete from public.announcements where id = $1;`, [
        created.announcementId,
      ]);

      await client.query(
        `delete from public.notifications where id in ($1,$2);`,
        [created.notifAId, created.notifBId],
      );
      await client.query(`delete from public.documents where id in ($1,$2);`, [
        created.docAId,
        created.docBId,
      ]);

      await client.query(`delete from public.drivers where id in ($1,$2);`, [
        created.driverA.driverId,
        created.driverB.driverId,
      ]);
      await client.query(`delete from public.customers where id = $1;`, [
        created.customer.customerId,
      ]);

      // company + role assignment
      await client.query(
        `delete from public.user_role_assignments where user_id = $1::uuid;`,
        [created.adminUser.userId],
      );
      await client.query(`delete from public.companies where id = $1;`, [
        created.companyId,
      ]);

      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      // don't throw on cleanup

      console.warn('cleanup failed', e);
    } finally {
      client.release();
      await pool.end().catch(() => {});
    }

    // cleanup auth users
    for (const uid of created.users) {
      try {
        await admin.auth.admin.deleteUser(uid);
      } catch {
        // ignore
      }
    }
  });

  it('Driver A cannot read Driver B documents (RLS SELECT)', async () => {
    const driverA = supaAuthed(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      created.driverA.jwt,
    );

    // fetch all driver docs visible to Driver A
    const { data, error } = await driverA
      .from('documents')
      .select('id, owner_type, owner_id, document_type')
      .eq('owner_type', 'driver');

    expect(error).toBeNull();

    const ownerIds = (data ?? []).map((r: any) => r.owner_id);
    expect(ownerIds).toContain(created.driverA.driverId);
    expect(ownerIds).not.toContain(created.driverB.driverId);

    // direct attempt to fetch Driver B doc should return empty
    const res2 = await driverA
      .from('documents')
      .select('id')
      .eq('id', created.docBId);
    expect(res2.error).toBeNull();
    expect((res2.data ?? []).length).toBe(0);
  });

  it('Driver cannot self-verify a document (RLS UPDATE / constraints)', async () => {
    const driverA = supaAuthed(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      created.driverA.jwt,
    );

    const { data, error } = await driverA
      .from('documents')
      .update({ status: 'verified' })
      .eq('id', created.docAId)
      .select('id, status');

    // RLS may block with error OR allow 0 rows updated
    if (error) {
      expect(error.message).toBeTruthy();
    } else {
      expect((data ?? []).length).toBe(0);
    }
  });

  it('Notifications are private + user can mark own as read', async () => {
    const driverA = supaAuthed(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      created.driverA.jwt,
    );

    const list = await driverA
      .from('notifications')
      .select('id, user_id, read_at');
    expect(list.error).toBeNull();

    const ids = (list.data ?? []).map((r: any) => r.id);
    expect(ids).toContain(created.notifAId);
    expect(ids).not.toContain(created.notifBId);

    // mark own as read
    const updOwn = await driverA
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', created.notifAId)
      .select('id, read_at');

    expect(updOwn.error).toBeNull();
    expect((updOwn.data ?? []).length).toBe(1);
    expect(updOwn.data![0].read_at).toBeTruthy();

    // try to mark B's as read -> should not update
    const updOther = await driverA
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', created.notifBId)
      .select('id');

    if (updOther.error) {
      expect(updOther.error.message).toBeTruthy();
    } else {
      expect((updOther.data ?? []).length).toBe(0);
    }
  });

  it('Customer can insert driver_rating only for delivered shipment that matches driver', async () => {
    const customer = supaAuthed(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      created.customer.jwt,
    );

    // valid insert (shipment belongs to customer + delivered + driver matches)
    const ok = await customer.from('driver_ratings').insert({
      driver_id: created.driverA.driverId,
      customer_id: created.customer.customerId,
      shipment_id: created.shipmentId,
      rating: 5,
      comment: 'solid',
    });

    expect(ok.error).toBeNull();

    // invalid: try to rate driverB using shipment that belongs to driverA
    const bad = await customer.from('driver_ratings').insert({
      driver_id: created.driverB.driverId,
      customer_id: created.customer.customerId,
      shipment_id: created.shipmentId,
      rating: 4,
      comment: 'should fail',
    });

    expect(bad.error).toBeTruthy();
  });
});
