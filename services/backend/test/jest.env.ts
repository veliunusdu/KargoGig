import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend root (for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Load .env.test on top with override=true (test env wins)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), override: true });
