import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MapsService } from '../maps/maps.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EstimateRideDto } from './dto/estimate-ride.dto';
import { CompleteRideDto } from './dto/complete-ride.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { mapRpcErrorToHttp } from '../common/utils/rpc-error.util';

type CompanyPricingRow = {
  currency: string | null;
  base_fare: number | string | null;
  per_km: number | string | null;
  per_minute: number | string | null;
  minimum_fare: number | string | null;
};

// RPC return types
type CustomerCancelResult = {
  shipment_id: number | null;
  fee_amount: number;
  fee_currency: string;
  payment_id: number | null;
};

type DriverCancelResult = {
  shipment_id: number;
  rebroadcasted: boolean;
  new_batch_id: number | null;
  new_target_count: number | null;
};

type DriverArriveResult = {
  shipment_id: number;
  status: string;
  arrived_at: string;
  wait_started_at: string;
};

type DriverStartResult = {
  shipment_id: number;
  status: string;
  picked_up_at: string;
  wait_ended_at: string | null;
};

type LocationUpdateResult = {
  shipment_id: number;
  inserted: boolean;
  eta_seconds: number | null;
  distance_remaining_meters: number | null;
};

type CompleteRideResult = {
  id: number;
  status: string;
  delivered_at: string;
  final_price: number;
  pod_signature: string | null;
  pod_photos: string[] | null;
};

@Injectable()
export class RidesService {
  private readonly DEFAULT_NEXT_WAVE_LIMIT = 5;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly maps: MapsService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toNumber(v: unknown, fallback = 0): number {
    if (v === null || v === undefined) return fallback;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  private parseDurationSeconds(duration: unknown): number {
    // Google Routes API often returns "2009s"
    if (typeof duration === 'string') {
      const m = duration.match(/(\d+)/);
      if (m) return Number(m[1]);
    }
    if (typeof duration === 'number' && Number.isFinite(duration))
      return duration;
    return 0;
  }

  async estimate(dto: EstimateRideDto) {
    if (!dto?.origin || !dto?.destination) {
      throw new BadRequestException('origin ve destination zorunlu');
    }
    if (!dto.companyId || dto.companyId <= 0) {
      throw new BadRequestException('companyId zorunlu ve > 0 olmalı');
    }

    // 1) Route compute (distance + duration)
    const route = await this.maps.computeRoute({
      origin: dto.origin,
      destination: dto.destination,
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    });
    const distanceMeters = this.toNumber((route as any)?.distanceMeters, 0);
    const durationSeconds = this.parseDurationSeconds((route as any)?.duration);

    if (!distanceMeters || !durationSeconds) {
      throw new InternalServerErrorException(
        'Route hesaplanamadı (distance/duration boş).',
      );
    }

    // 2) Pricing (active, newest)
    const sb = this.supabase.admin();

    const { data, error } = await sb
      .from('company_pricing')
      .select('currency,base_fare,per_km,per_minute,minimum_fare')
      .eq('company_id', dto.companyId)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        `Pricing fetch error: ${error.message}`,
      );
    }
    if (!data) {
      throw new BadRequestException(
        `company_pricing bulunamadı (company_id=${dto.companyId})`,
      );
    }

    const p = data as CompanyPricingRow;

    const baseFare = this.toNumber(p.base_fare, 0);
    const perKm = this.toNumber(p.per_km, 0);
    const perMinute = this.toNumber(p.per_minute, 0);
    const minimumFare = this.toNumber(p.minimum_fare, 0);

    const km = distanceMeters / 1000;
    const minutes = durationSeconds / 60;

    const raw = baseFare + perKm * km + perMinute * minutes;
    const final = Math.max(raw, minimumFare);

    const price = Math.round(final * 100) / 100;

    return {
      ok: true,
      companyId: dto.companyId,
      currency: p.currency ?? 'TRY',
      distanceMeters,
      durationSeconds,
      km: Math.round(km * 1000) / 1000,
      minutes: Math.round(minutes * 100) / 100,
      price,
      breakdown: {
        baseFare,
        perKm,
        perMinute,
        minimumFare,
        raw: Math.round(raw * 100) / 100,
      },
    };
  }

  /**
   * Customer cancels an announcement/ride.
   * Uses user's JWT token so auth.uid() works in RPC.
   */
  async customerCancel(
    announcementId: number,
    reason: string | null,
    authHeader: string,
  ): Promise<{ ok: true; result: CustomerCancelResult }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    // Create client with user's JWT token -> auth.uid() will be set
    const sb = this.supabase.asUser(authHeader);

    const { data, error } = await sb.rpc('customer_cancel_announcement', {
      p_announcement_id: announcementId,
      p_reason: reason,
    });

    if (error) {
      throw mapRpcErrorToHttp(error);
    }

    // RPC returns a single row or array of rows
    const result = Array.isArray(data) ? data[0] : data;

    return { ok: true, result };
  }

  /**
   * Driver cancels their assignment for an announcement/ride.
   * Triggers unassign + potential rebroadcast.
   * Uses user's JWT token so auth.uid() works in RPC.
   */
  async driverCancel(
    announcementId: number,
    reason: string,
    authHeader: string,
  ): Promise<{ ok: true; result: DriverCancelResult }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    // Create client with user's JWT token -> auth.uid() will be set
    const sb = this.supabase.asUser(authHeader);

    const { data, error } = await sb.rpc('driver_cancel_assignment', {
      p_announcement_id: announcementId,
      p_reason: reason,
      p_next_wave_limit: this.DEFAULT_NEXT_WAVE_LIMIT,
    });

    if (error) {
      throw mapRpcErrorToHttp(error);
    }

    // RPC returns a single row or array of rows
    const result = Array.isArray(data) ? data[0] : data;

    return { ok: true, result };
  }

  /**
   * Driver marks arrival at the pickup location.
   * Calls the driver_arrive_ride RPC which:
   *  - validates the driver owns this shipment
   *  - sets status='arrived', arrived_at=now(), wait_started_at=now()
   *  - creates a notification for the customer
   * Uses user's JWT token so auth.uid() works in RPC.
   */
  async arrive(
    shipmentId: number,
    authHeader: string,
  ): Promise<{ ok: true; ride: DriverArriveResult }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const sb = this.supabase.asUser(authHeader);

    const { data, error } = await sb.rpc('driver_arrive_ride', {
      p_shipment_id: shipmentId,
    });

    if (error) {
      throw mapRpcErrorToHttp(error);
    }

    const ride = Array.isArray(data) ? data[0] : data;

    // Notification: Driver arrived at pickup
    try {
      const { data: shipment } = await this.supabase.getClient()
        .from('shipments')
        .select('customer_id')
        .eq('id', shipmentId)
        .single();

      if (shipment?.customer_id) {
        this.notificationsService
          .onShipmentArrived(shipmentId, shipment.customer_id)
          .catch((err) => console.error('[RidesService] Notification failed:', err));
      }
    } catch (notifError) {
      console.error('[RidesService] Failed to send notification:', notifError);
    }

    return { ok: true, ride };
  }

  /**
   * Driver starts the ride (picks up cargo).
   * Calls the driver_start_ride RPC which:
   *  - validates the driver owns this shipment
   *  - validates status = 'arrived' (must arrive before starting)
   *  - validates geo-fence (driver must be within radius of pickup location)
   *  - sets status='in_progress', picked_up_at=now(), wait_ended_at=now()
   *  - creates a notification for the customer
   * Uses user's JWT token so auth.uid() works in RPC.
   */
  async start(
    shipmentId: number,
    authHeader: string,
  ): Promise<{ ok: true; ride: DriverStartResult }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const sb = this.supabase.asUser(authHeader);

    const { data, error } = await sb.rpc('driver_start_ride', {
      p_shipment_id: shipmentId,
    });

    if (error) {
      throw mapRpcErrorToHttp(error);
    }

    const ride = Array.isArray(data) ? data[0] : data;

    // Notification: Cargo picked up
    try {
      const { data: shipment } = await this.supabase.getClient()
        .from('shipments')
        .select('customer_id')
        .eq('id', shipmentId)
        .single();

      if (shipment?.customer_id) {
        this.notificationsService
          .onShipmentStarted(shipmentId, shipment.customer_id)
          .catch((err) => console.error('[RidesService] Notification failed:', err));
      }
    } catch (notifError) {
      console.error('[RidesService] Failed to send notification:', notifError);
    }

    return { ok: true, ride };
  }

  /**
   * Driver updates their location during an active ride.
   * Calls the driver_update_ride_location RPC which:
   *  - validates the driver owns this shipment
   *  - validates status = 'in_progress' (must be actively driving)
   *  - updates driver_locations table
   *  - inserts into shipment_tracking (rate-limited to avoid spam)
   *  - calculates ETA based on remaining distance
   * Uses user's JWT token so auth.uid() works in RPC.
   */
  async updateLocation(
    shipmentId: number,
    lat: number,
    lng: number,
    authHeader: string,
  ): Promise<{ ok: true; result: LocationUpdateResult }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const sb = this.supabase.asUser(authHeader);

    const { data, error } = await sb.rpc('driver_update_ride_location', {
      p_shipment_id: shipmentId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      throw mapRpcErrorToHttp(error);
    }

    const result = Array.isArray(data) ? data[0] : data;

    return { ok: true, result };
  }

  /**
   * Driver completes the delivery at dropoff location.
   * Calls the driver_complete_ride RPC which:
   *  - validates the driver owns this shipment
   *  - validates status = 'in_progress' (must be actively delivering)
   *  - validates geo-fence (driver must be within radius of dropoff location)
   *  - calculates final price based on actual distance/duration and company pricing
   *  - sets status='completed', delivered_at=now(), final_price
   *  - optionally stores POD (signature + photos)
   *  - creates a notification for the customer
   * Uses user's JWT token so auth.uid() works in RPC.
   */
  async complete(
    shipmentId: number,
    dto: CompleteRideDto,
    authHeader: string,
  ): Promise<{ ok: true; ride: CompleteRideResult }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const sb = this.supabase.asUser(authHeader);

    const { data, error } = await sb.rpc('driver_complete_ride', {
      p_shipment_id: shipmentId,
      p_lat: dto.lat,
      p_lng: dto.lng,
      p_pod_signature: dto.pod_signature ?? null,
      p_pod_photos: dto.pod_photos ?? null,
    });

    if (error) {
      throw mapRpcErrorToHttp(error);
    }

    const ride = Array.isArray(data) ? data[0] : data;

    // Notification: Cargo delivered
    try {
      const { data: shipment } = await this.supabase.getClient()
        .from('shipments')
        .select('customer_id')
        .eq('id', shipmentId)
        .single();

      if (shipment?.customer_id) {
        this.notificationsService
          .onShipmentCompleted(shipmentId, shipment.customer_id)
          .catch((err) => console.error('[RidesService] Notification failed:', err));
      }
    } catch (notifError) {
      console.error('[RidesService] Failed to send notification:', notifError);
    }

    return { ok: true, ride };
  }

  // ─────────────────────────────────────────────────────────────
  // PAYMENT (Day 2 — POST /rides/:id/pay)
  // ─────────────────────────────────────────────────────────────

  /**
   * Initiate payment for a completed ride.
   * Delegates to PaymentsService for all payment logic.
   */
  async pay(shipmentId: number, authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }
    return this.paymentsService.createCheckoutForShipment(shipmentId, authHeader);
  }

  // ─────────────────────────────────────────────────────────────
  // RATING (Day 7 — POST /rides/:id/rate)
  // ─────────────────────────────────────────────────────────────

  /**
   * Rate a completed ride (driver + company).
   * Flow:
   *   1. Find ride → check completed
   *   2. Get driver_id, company_id
   *   3. Insert ride_ratings (target=driver) if driver_rating provided
   *   4. Insert ride_ratings (target=company) if company_rating provided
   *   5. Triggers automatically update averages (drivers.rating, companies.rating_avg)
   */
  async rate(
    shipmentId: number,
    dto: RateRideDto,
    authHeader?: string,
  ): Promise<{ ok: boolean; inserted: number }> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    // Validate at least one rating provided
    if (!dto.driver_rating && !dto.company_rating) {
      throw new BadRequestException('At least one rating (driver or company) is required');
    }

    // Use user token for RLS
    const sb = this.supabase.asUser(authHeader);

    // 1) Find shipment and verify it's completed
    const { data: shipment, error: shipmentError } = await sb
      .from('shipments')
      .select('id, status, driver_id, company_id, customer_id')
      .eq('id', shipmentId)
      .single();

    if (shipmentError || !shipment) {
      throw new BadRequestException('Shipment not found');
    }

    if (shipment.status !== 'completed') {
      throw new BadRequestException(
        `Cannot rate shipment: status is '${shipment.status}', must be 'completed'`,
      );
    }

    let inserted = 0;

    // 2) Insert driver rating if provided
    if (dto.driver_rating && shipment.driver_id) {
      const { error: driverError } = await sb.from('ride_ratings').insert({
        shipment_id: shipmentId,
        customer_id: shipment.customer_id,
        target_type: 'driver',
        target_id: shipment.driver_id,
        rating: dto.driver_rating,
        comment: dto.comment || null,
      });

      // UNIQUE constraint (shipment_id, customer_id, target_type, target_id) → idempotent
      if (driverError) {
        // 23505 = duplicate key (idempotent, already rated)
        if (driverError.code !== '23505') {
          throw new InternalServerErrorException(
            `Failed to insert driver rating: ${driverError.message}`,
          );
        }
      } else {
        inserted++;
      }
    }

    // 3) Insert company rating if provided
    if (dto.company_rating && shipment.company_id) {
      const { error: companyError } = await sb.from('ride_ratings').insert({
        shipment_id: shipmentId,
        customer_id: shipment.customer_id,
        target_type: 'company',
        target_id: shipment.company_id,
        rating: dto.company_rating,
        comment: dto.comment || null,
      });

      // UNIQUE constraint → idempotent
      if (companyError) {
        if (companyError.code !== '23505') {
          throw new InternalServerErrorException(
            `Failed to insert company rating: ${companyError.message}`,
          );
        }
      } else {
        inserted++;
      }
    }

    return { ok: true, inserted };
  }
}

