import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MapsService } from '../maps/maps.service';
import { EstimateRideDto } from './dto/estimate-ride.dto';

type CompanyPricingRow = {
  currency: string | null;
  base_fare: number | string | null;
  per_km: number | string | null;
  per_minute: number | string | null;
  minimum_fare: number | string | null;
};

@Injectable()
export class RidesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly maps: MapsService,
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
    if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
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
      throw new InternalServerErrorException('Route hesaplanamadı (distance/duration boş).');
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
      throw new InternalServerErrorException(`Pricing fetch error: ${error.message}`);
    }
    if (!data) {
      throw new BadRequestException(`company_pricing bulunamadı (company_id=${dto.companyId})`);
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
}
