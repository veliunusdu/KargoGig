import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly adminClient: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !anonKey || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY eksik. .env dosyanı kontrol et.',
      );
    }

    this.url = url;
    this.anonKey = anonKey;

    // Admin client (RLS BYPASS) — server-side only!
    this.adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Admin-only client (RLS BYPASS). */
  admin(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Legacy compatibility:
   * Projedeki eski servisler `.getClient()` çağırıyor olabilir.
   * Onları kırmamak için admin client döndürüyoruz.
   */
  getClient(): SupabaseClient {
    return this.adminClient;
  }

  /** User-scoped client (RLS enforced) */
  asUser(accessToken: string): SupabaseClient {
    if (!accessToken) throw new Error('Missing access token');

    return createClient(this.url, this.anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}
