import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import * as express from 'express';

/**
 * E2E tests for ride rating (Day 7).
 *
 * Tests:
 *   A — Cannot rate before completion → 400
 *   B — Rate after completion → 201 + ride_ratings rows
 *   C — Idempotent (same ride, same user, same target) → no duplicate
 *   D — Averages updated (driver.rating, companies.rating_avg)
 */
describe('Ride Rating (e2e)', () => {
  let app: INestApplication;
  let supabaseAdmin: SupabaseClient;

  // Test entities
  let companyId: number | null = null;
  let ownerUserId: string | null = null;
  let customerUserId: string | null = null;
  let customerId: number | null = null;
  let customerToken: string | null = null;
  let driverUserId: string | null = null;
  let driverId: number | null = null;
  let vehicleId: number | null = null;

  // IDs for cleanup
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
   * Create a shipment with specific status.
   */
  async function createShipmentWithStatus(
    status: string,
    finalPrice: number,
  ): Promise<number> {
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
        status,
        final_price: finalPrice,
      })
      .select('id')
      .single();

    if (shipError) throw shipError;
    createdShipmentIds.push(shipment.id);

    return shipment.id;
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
      const email = `owner-rating-${Date.now()}@test.dev`;
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
      const { data: c, error: cErr } = await supabaseAdmin
        .from('companies')
        .insert({
          owner_user_id: ownerUserId,
          name: 'Rating Test Co',
          vat_number: 'VAT-RATING-12345',
          email: 'rating@testco.dev',
          phone: '+901112223344',
          address: 'Rating St',
          city: 'Istanbul',
        })
        .select('id')
        .single();
      if (cErr) throw cErr;
      companyId = c.id;
    }

    // Customer user
    {
      const email = `customer-rating-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      customerUserId = u.user.id;

      const { data: cust, error: custErr } = await supabaseAdmin
        .from('customers')
        .insert({ user_id: customerUserId })
        .select('id')
        .single();
      if (custErr) throw custErr;
      customerId = cust.id;

      // Get customer token
      const { data: session, error: sessionErr } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      if (sessionErr) throw sessionErr;
      customerToken = `Bearer ${session.session.access_token}`;
    }

    // Driver user
    {
      const email = `driver-rating-${Date.now()}@test.dev`;
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (uErr) throw uErr;
      driverUserId = u.user.id;

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
          plate_number: 'RATING-34-TEST',
          capacity: 1000,
        })
        .select('id')
        .single();
      if (vehErr) throw vehErr;
      vehicleId = veh.id;
    }
  });

  // ── Teardown ──────────────────────────────────────────────────────────
  afterAll(async () => {
    // Clean up test data
    if (createdShipmentIds.length) {
      await supabaseAdmin.from('ride_ratings').delete().in('shipment_id', createdShipmentIds);
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
    if (companyId) await supabaseAdmin.from('companies').delete().eq('id', companyId);
    if (ownerUserId) await supabaseAdmin.auth.admin.deleteUser(ownerUserId);
    if (customerUserId) await supabaseAdmin.auth.admin.deleteUser(customerUserId);
    if (driverUserId) await supabaseAdmin.auth.admin.deleteUser(driverUserId);

    await app.close();
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test A — Cannot rate before completion → 400                        ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('A) Should reject rating for non-completed shipment (400)', async () => {
    const shipmentId = await createShipmentWithStatus('in_progress', 100);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId}/rate`)
      .set('Authorization', customerToken!)
      .send({
        driver_rating: 5,
        company_rating: 4,
        comment: 'Great service!',
      })
      .expect(400);

    expect(response.body.message).toContain('Cannot rate shipment');
    expect(response.body.message).toContain('in_progress');
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test B — Rate after completion → 201 + ride_ratings rows            ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('B) Should rate completed shipment and insert ride_ratings rows', async () => {
    const shipmentId = await createCompletedShipment(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId}/rate`)
      .set('Authorization', customerToken!)
      .send({
        driver_rating: 5,
        company_rating: 4,
        comment: 'Fast and clean delivery!',
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    expect(response.body.inserted).toBe(2); // Both driver and company ratings

    // Verify driver rating row
    const { data: driverRating } = await supabaseAdmin
      .from('ride_ratings')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('target_type', 'driver')
      .eq('target_id', driverId!)
      .single();

    expect(driverRating).toBeDefined();
    expect(driverRating!.rating).toBe(5);
    expect(driverRating!.comment).toBe('Fast and clean delivery!');
    expect(driverRating!.customer_id).toBe(customerId);

    // Verify company rating row
    const { data: companyRating } = await supabaseAdmin
      .from('ride_ratings')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('target_type', 'company')
      .eq('target_id', companyId!)
      .single();

    expect(companyRating).toBeDefined();
    expect(companyRating!.rating).toBe(4);
    expect(companyRating!.comment).toBe('Fast and clean delivery!');
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test C — Idempotent (same ride, same user, same target)             ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('C) Should handle duplicate ratings idempotently (201, inserted=0)', async () => {
    const shipmentId = await createCompletedShipment(150);

    // First rating
    const response1 = await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId}/rate`)
      .set('Authorization', customerToken!)
      .send({
        driver_rating: 4,
        company_rating: 5,
      })
      .expect(201);

    expect(response1.body.ok).toBe(true);
    expect(response1.body.inserted).toBe(2);

    // Second rating (duplicate)
    const response2 = await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId}/rate`)
      .set('Authorization', customerToken!)
      .send({
        driver_rating: 3, // Different rating, should be ignored
        company_rating: 2,
      })
      .expect(201);

    expect(response2.body.ok).toBe(true);
    expect(response2.body.inserted).toBe(0); // No new rows inserted

    // Verify only one rating per target exists
    const { data: driverRatings } = await supabaseAdmin
      .from('ride_ratings')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('target_type', 'driver');

    expect(driverRatings!.length).toBe(1);
    expect(driverRatings![0].rating).toBe(4); // Original rating preserved

    const { data: companyRatings } = await supabaseAdmin
      .from('ride_ratings')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('target_type', 'company');

    expect(companyRatings!.length).toBe(1);
    expect(companyRatings![0].rating).toBe(5); // Original rating preserved
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test D — Averages updated (driver.rating, companies.rating_avg)     ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('D) Should update driver.rating and companies.rating_avg via triggers', async () => {
    // Get initial averages
    const { data: driverBefore } = await supabaseAdmin
      .from('drivers')
      .select('rating')
      .eq('id', driverId!)
      .single();

    const { data: companyBefore } = await supabaseAdmin
      .from('companies')
      .select('rating_avg')
      .eq('id', companyId!)
      .single();

    const initialDriverRating = driverBefore?.rating || 0;
    const initialCompanyRating = companyBefore?.rating_avg || 0;

    // Create and rate a completed shipment
    const shipmentId = await createCompletedShipment(250);

    await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId}/rate`)
      .set('Authorization', customerToken!)
      .send({
        driver_rating: 5,
        company_rating: 4,
      })
      .expect(201);

    // Allow trigger time to execute (small delay)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get updated averages
    const { data: driverAfter } = await supabaseAdmin
      .from('drivers')
      .select('rating')
      .eq('id', driverId!)
      .single();

    const { data: companyAfter } = await supabaseAdmin
      .from('companies')
      .select('rating_avg')
      .eq('id', companyId!)
      .single();

    // Driver rating should be updated (or at least not null)
    expect(driverAfter?.rating).toBeDefined();
    expect(driverAfter?.rating).not.toBe(initialDriverRating);
    expect(driverAfter?.rating).toBeGreaterThan(0);

    // Company rating should be updated (or at least not null)
    expect(companyAfter?.rating_avg).toBeDefined();
    expect(companyAfter?.rating_avg).not.toBe(initialCompanyRating);
    expect(companyAfter?.rating_avg).toBeGreaterThan(0);

    console.log(
      `[Test D] Driver rating: ${initialDriverRating} → ${driverAfter?.rating}`,
    );
    console.log(
      `[Test D] Company rating: ${initialCompanyRating} → ${companyAfter?.rating_avg}`,
    );
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test E — Partial rating (only driver or only company)               ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('E) Should allow rating only driver or only company', async () => {
    const shipmentId1 = await createCompletedShipment(80);
    const shipmentId2 = await createCompletedShipment(90);

    // Rate only driver
    const response1 = await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId1}/rate`)
      .set('Authorization', customerToken!)
      .send({
        driver_rating: 3,
      })
      .expect(201);

    expect(response1.body.inserted).toBe(1);

    // Rate only company
    const response2 = await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId2}/rate`)
      .set('Authorization', customerToken!)
      .send({
        company_rating: 5,
      })
      .expect(201);

    expect(response2.body.inserted).toBe(1);

    // Verify rows
    const { data: ratings1 } = await supabaseAdmin
      .from('ride_ratings')
      .select('*')
      .eq('shipment_id', shipmentId1);

    expect(ratings1!.length).toBe(1);
    expect(ratings1![0].target_type).toBe('driver');

    const { data: ratings2 } = await supabaseAdmin
      .from('ride_ratings')
      .select('*')
      .eq('shipment_id', shipmentId2);

    expect(ratings2!.length).toBe(1);
    expect(ratings2![0].target_type).toBe('company');
  });

  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ Test F — Reject empty rating (no driver_rating, no company_rating)  ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  it('F) Should reject rating with no driver_rating and no company_rating (400)', async () => {
    const shipmentId = await createCompletedShipment(120);

    await request(app.getHttpServer())
      .post(`/api/v1/rides/${shipmentId}/rate`)
      .set('Authorization', customerToken!)
      .send({
        comment: 'No rating provided',
      })
      .expect(400);
  });
});
