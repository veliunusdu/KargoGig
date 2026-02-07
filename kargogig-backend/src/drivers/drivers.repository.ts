import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import {
  RPC_UPSERT_MY_DRIVER_LOCATION,
  RPC_DRIVERS_WITHIN_RADIUS,
  TABLE_DRIVERS,
  TABLE_DRIVER_LOCATIONS,
} from './constants/drivers.constants';
import {
  DriverNearbyResultRaw,
  DriverWithRelations,
  Driver,
} from './types';

/**
 * Repository layer for driver-related database operations
 * Thin wrapper around Supabase calls
 */
@Injectable()
export class DriversRepository {
  private readonly logger = new Logger(DriversRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get service role client (RLS bypass)
   */
  private get serviceClient(): SupabaseClient {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Get user-scoped client (RLS enforced)
   */
  private getUserClient(token: string): SupabaseClient {
    return this.supabaseService.asUser(token);
  }

  // ─────────────────────────────────────────────────────────────
  // DRIVER CRUD OPERATIONS
  // ─────────────────────────────────────────────────────────────

  async createDriver(data: {
    user_id: string;
    company_id?: number;
    license_number?: string;
  }): Promise<{ data: Driver | null; error: Error | null }> {
    const { data: result, error } = await this.serviceClient
      .from(TABLE_DRIVERS)
      .insert(data)
      .select()
      .single();

    return { data: result as Driver | null, error };
  }

  async findDriverById(id: number): Promise<{ data: DriverWithRelations | null; error: Error | null }> {
    const { data, error } = await this.serviceClient
      .from(TABLE_DRIVERS)
      .select(`
        *,
        companies:company_id (id, name),
        profiles:user_id (name, phone, email)
      `)
      .eq('id', id)
      .single();

    return { data: data as DriverWithRelations | null, error };
  }

  async findDriverByUserId(userId: string): Promise<{ data: DriverWithRelations | null; error: Error | null }> {
    const { data, error } = await this.serviceClient
      .from(TABLE_DRIVERS)
      .select(`
        *,
        companies:company_id (id, name),
        profiles:user_id (name, phone, email)
      `)
      .eq('user_id', userId)
      .single();

    return { data: data as DriverWithRelations | null, error };
  }

  async findDriversByCompanyId(companyId: number): Promise<{ data: DriverWithRelations[] | null; error: Error | null }> {
    const { data, error } = await this.serviceClient
      .from(TABLE_DRIVERS)
      .select(`
        *,
        profiles:user_id (name, phone, email)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    return { data: data as DriverWithRelations[] | null, error };
  }

  async updateDriver(
    id: number,
    updateData: {
      license_number?: string;
      availability?: string;
      is_available?: boolean;
      company_id?: number;
    },
  ): Promise<{ data: Driver | null; error: Error | null }> {
    const { data, error } = await this.serviceClient
      .from(TABLE_DRIVERS)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    return { data: data as Driver | null, error };
  }

  // ─────────────────────────────────────────────────────────────
  // LOCATION RPC OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Upsert driver's own location (RLS enforced)
   * Uses user's JWT token for authentication
   */
  async upsertMyLocation(
    token: string,
    lat: number,
    lng: number,
  ): Promise<{ data: unknown; error: Error | null }> {
    this.logger.log(`[upsertMyLocation] Calling RPC with lat=${lat}, lng=${lng}`);

    const userClient = this.getUserClient(token);

    const { data, error } = await userClient.rpc(RPC_UPSERT_MY_DRIVER_LOCATION, {
      p_lat: lat,
      p_lng: lng,
    });

    this.logger.log(
      `[upsertMyLocation] RPC result: success=${!error}, error=${error?.message ?? 'none'}`,
    );

    return { data, error };
  }

  /**
   * Find drivers within radius (service role, no RLS)
   */
  async findDriversWithinRadius(params: {
    lat: number;
    lng: number;
    radiusM: number;
    limit: number;
  }): Promise<{ data: DriverNearbyResultRaw[] | null; error: Error | null }> {
    this.logger.log(
      `[findDriversWithinRadius] Calling RPC with lat=${params.lat}, lng=${params.lng}, radius=${params.radiusM}, limit=${params.limit}`,
    );

    const { data, error } = await this.serviceClient.rpc(RPC_DRIVERS_WITHIN_RADIUS, {
      p_lat: params.lat,
      p_lng: params.lng,
      p_radius_m: params.radiusM,
      p_limit: params.limit,
    });

    this.logger.log(
      `[findDriversWithinRadius] RPC result: count=${Array.isArray(data) ? data.length : 0}, error=${error?.message ?? 'none'}`,
    );

    return { data: data as DriverNearbyResultRaw[] | null, error };
  }

  // ─────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT (Day 5)
  // ─────────────────────────────────────────────────────────────

  /**
   * Mark driver as online (RLS enforced)
   * Uses user's JWT token for authentication
   */
  async goOnline(
    token: string,
    deviceType: string,
    deviceToken: string | null,
  ): Promise<{ data: { ok: boolean; driver_id: number; is_online: boolean } | null; error: Error | null }> {
    this.logger.log(`[goOnline] device_type=${deviceType}, has_token=${!!deviceToken}`);

    const userClient = this.getUserClient(token);

    const { data, error } = await userClient.rpc('driver_go_online', {
      p_device_type: deviceType,
      p_device_token: deviceToken,
    });

    this.logger.log(
      `[goOnline] RPC result: success=${!error}, error=${error?.message ?? 'none'}`,
    );

    return { data, error };
  }

  /**
   * Mark driver as offline (RLS enforced)
   * Uses user's JWT token for authentication
   */
  async goOffline(
    token: string,
    deviceType: string,
  ): Promise<{ data: { ok: boolean; driver_id: number; is_online: boolean } | null; error: Error | null }> {
    this.logger.log(`[goOffline] device_type=${deviceType}`);

    const userClient = this.getUserClient(token);

    const { data, error } = await userClient.rpc('driver_go_offline', {
      p_device_type: deviceType,
    });

    this.logger.log(
      `[goOffline] RPC result: success=${!error}, error=${error?.message ?? 'none'}`,
    );

    return { data, error };
  }

  // ─────────────────────────────────────────────────────────────
  // DEBUG HELPERS (temporary)
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if driver_locations table has any data (debug helper)
   */
  async debugCheckDriverLocations(): Promise<{ count: number; sample: unknown }> {
    const { data, error } = await this.serviceClient
      .from(TABLE_DRIVER_LOCATIONS)
      .select('driver_id, lat, lng, last_seen_at')
      .limit(5);

    if (error) {
      this.logger.warn(`[debugCheckDriverLocations] Error: ${error.message}`);
      return { count: 0, sample: null };
    }

    return {
      count: data?.length ?? 0,
      sample: data?.[0] ?? null,
    };
  }
}
