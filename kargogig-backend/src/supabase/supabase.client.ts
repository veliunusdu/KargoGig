import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export function createSupabaseClient(config: ConfigService) {
  const url = config.get<string>('SUPABASE_URL');
  const anonKey = config.get<string>('SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL veya SUPABASE_ANON_KEY eksik.');
  }

  return createClient(url, anonKey);
}
