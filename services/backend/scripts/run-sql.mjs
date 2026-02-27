// Quick SQL runner for Supabase via service_role rpc
// Usage: node scripts/run-sql.mjs "SELECT 1"
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });
dotenv.config({ path: resolve(__dirname, '..', '.env.test'), override: true });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sql = process.argv[2]?.endsWith('.sql')
  ? readFileSync(resolve(process.argv[2]), 'utf8')
  : process.argv[2];

if (!sql) { console.error('Usage: node run-sql.mjs "<SQL>" or run-sql.mjs file.sql'); process.exit(1); }

const { data, error } = await sb.rpc('exec_sql', { query: sql });
if (error) {
  // If exec_sql doesn't exist, try pg_query
  console.error('exec_sql RPC not found, trying direct approach...');
  console.error('Error:', error.message);
  console.log('Please run the SQL manually in Supabase SQL Editor:');
  console.log('---');
  console.log(sql);
  console.log('---');
  process.exit(1);
}
console.log('Result:', JSON.stringify(data, null, 2));
