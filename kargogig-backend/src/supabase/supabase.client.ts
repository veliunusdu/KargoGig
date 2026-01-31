import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export function createSupabaseClient(config: ConfigService) {
  const url = config.get<string>('SUPABASE_URL');
  const serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.');
  }

  return createClient(url, serviceRoleKey);
}
