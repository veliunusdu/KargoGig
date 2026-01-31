import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      throw new Error('SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik. .env dosyanı kontrol et.');
    }

    this.client = createClient(url, serviceRoleKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
