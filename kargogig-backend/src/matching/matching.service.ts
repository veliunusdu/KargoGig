import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type MatchOptions = {
  radius_meters?: number;
  limit?: number;
};

type AnnouncementForMatch = {
  id: number;
  pickup_lat: number | null;
  pickup_lng: number | null;
  vehicle_category: string | null;
  company_id: number | null;
};

@Injectable()
export class MatchingService {
  private readonly supabaseAdmin: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      // “Tell it like it is”: bu yoksa matching çalışmaz.
      throw new Error(
        'Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (required for matching)',
      );
    }

    this.supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async matchAnnouncement(announcementId: number, opts: MatchOptions = {}) {
    const radius_meters = opts.radius_meters ?? 5000;
    const limit = opts.limit ?? 20;

    // 1) Announcement çek
    const { data: ann, error: annErr } = await this.supabaseAdmin
      .from('announcements')
      .select('id, pickup_lat, pickup_lng, vehicle_category, company_id')
      .eq('id', announcementId)
      .single<AnnouncementForMatch>();

    if (annErr) {
      throw new Error(`Failed to load announcement: ${annErr.message}`);
    }
    if (!ann) {
      throw new Error('Announcement not found');
    }

    // pickup_lat/lng şart (senin flow’da Day4 maps bunları dolduruyor olmalı)
    if (ann.pickup_lat == null || ann.pickup_lng == null) {
      throw new Error(
        'Announcement missing pickup_lat/pickup_lng. Ensure maps/geocode+route step sets these fields.',
      );
    }

    // 2) RPC: find_nearby_drivers çağır
    const { data: matches, error: rpcErr } = await this.supabaseAdmin.rpc(
      'find_nearby_drivers',
      {
        p_pickup_lat: ann.pickup_lat,
        p_pickup_lng: ann.pickup_lng,
        p_radius_meters: radius_meters,
        p_vehicle_category: ann.vehicle_category ?? null,
        p_company_id: ann.company_id ?? null,
        p_limit: limit,
      },
    );

    if (rpcErr) {
      throw new Error(`Matching RPC failed: ${rpcErr.message}`);
    }

    return {
      announcement_id: ann.id,
      pickup: { lat: ann.pickup_lat, lng: ann.pickup_lng },
      filters: {
        radius_meters,
        limit,
        vehicle_category: ann.vehicle_category,
        company_id: ann.company_id,
      },
      matches: matches ?? [],
    };
  }
}
