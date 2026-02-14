import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

describe('Matching E2E (ride -> match)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  let companyId: number | null = null;
  let ownerUserId: string | null = null;

  let customerUserId: string | null = null;
  let customerId: number | null = null;
  let announcementId: number | null = null;

  const driverUserIds: string[] = [];
  const driverIds: number[] = [];
  const vehicleIds: number[] = [];

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
    await app.init();

    // Owner user
    {
      const email = `owner${Date.now()}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: 'password123',
          email_confirm: true,
        });
      if (uErr) throw uErr;
      ownerUserId = u.user.id;
    }

    // Company via RPC (auth.uid() not null)
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

    // 2 drivers + vehicles + locations
    for (let i = 0; i < 2; i++) {
      const email = `driver${Date.now()}_${i}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: 'password123',
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

      const plate = `TST-${Date.now()}-${i}`;
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

      const pickupLat = 41.0082;
      const pickupLng = 28.9784;
      const lat = i === 0 ? pickupLat : pickupLat + 0.01;
      const lng = pickupLng;

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
    }

    // customer - auth.users trigger auto-creates customer, so we just select it
    {
      const email = `customer${Date.now()}@test.dev`;
      const { data: u, error: uErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: 'password123',
          email_confirm: true,
        });
      if (uErr) throw uErr;

      customerUserId = u.user.id;

      // Wait a brief moment for trigger to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fetch the auto-created customer record
      const { data: c, error: cErr } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', customerUserId)
        .single();

      if (cErr) throw cErr;
      customerId = c.id;
    }

    // announcement
    {
      const pickupLat = 41.0082;
      const pickupLng = 28.9784;
      const deliveryLat = 41.0182;
      const deliveryLng = 28.9884;

      const { data: a, error: aErr } = await supabaseAdmin
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

      if (aErr) throw aErr;
      announcementId = a.id;
    }
  });

  afterAll(async () => {
    try {
      if (announcementId)
        await supabaseAdmin
          .from('announcements')
          .delete()
          .eq('id', announcementId);

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

  it('should match nearby drivers sorted by distance', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/announcements/${announcementId}/match?radius_meters=5000&limit=10`,
      )
      .expect((r) => {
        if (![200, 201].includes(r.status)) {
          throw new Error(
            `Unexpected status ${r.status}: ${JSON.stringify(r.body)}`,
          );
        }
      });

    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.matches)).toBe(true);

    const matches = res.body.matches as Array<{ distance_meters: number }>;
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0].distance_meters).toBeLessThanOrEqual(
      matches[1].distance_meters,
    );
    expect(matches[0].distance_meters).toBeLessThanOrEqual(5000);
  });
});
