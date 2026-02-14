import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly serviceRoleKey: string;

  private readonly anon: SupabaseClient;
  private readonly service: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('SUPABASE_URL') ?? '';
    this.anonKey = this.config.get<string>('SUPABASE_ANON_KEY') ?? '';
    this.serviceRoleKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Debug ENV loading (especially for E2E tests)
    console.log('[SUPABASE]', {
      url: this.url ? 'ok' : 'missing',
      anonLen: this.anonKey?.length ?? 0,
      serviceLen: this.serviceRoleKey?.length ?? 0,
    });

    if (!this.url || !this.anonKey || !this.serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY eksik. .env dosyanı kontrol et.',
      );
    }

    // server-side safe (no session persistence)
    this.anon = createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.service = createClient(this.url, this.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Preferred API
  serviceClient(): SupabaseClient {
    return this.service;
  }

  anonClient(): SupabaseClient {
    return this.anon;
  }

  anonClientWithAuth(authHeaderOrToken: string): SupabaseClient {
    const header = authHeaderOrToken?.startsWith('Bearer ')
      ? authHeaderOrToken
      : `Bearer ${authHeaderOrToken ?? ''}`;

    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: header } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Backward compatibility (IMPORTANT)
  getClient(): SupabaseClient {
    return this.anonClient();
  }

  getServiceClient(): SupabaseClient {
    return this.serviceClient();
  }

  asUser(tokenOrHeader: string): SupabaseClient {
    return this.anonClientWithAuth(tokenOrHeader);
  }

  admin(): SupabaseClient {
    return this.serviceClient();
  }
}
