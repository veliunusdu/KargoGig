import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');

    if (!url || !anonKey) {
      throw new Error('SUPABASE_URL veya SUPABASE_ANON_KEY eksik. .env dosyanı kontrol et.');
    }

    this.client = createClient(url, anonKey);
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
