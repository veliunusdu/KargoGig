import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend root (for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

// Layer .env.test on top (won't override values already set by .env)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
