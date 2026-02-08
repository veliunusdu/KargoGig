import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env and .env.test
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) throw new Error('Missing env: SUPABASE_DB_URL (or DATABASE_URL)');

console.log('Testing connection with URL:', DB_URL.replace(/:([^:@]+)@/, ':****@'));

const pool = new Pool({ 
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to database!');
    
    const result = await client.query('SELECT version()');
    console.log('✅ Version:', result.rows[0].version);
    
    const userResult = await client.query('SELECT current_user, current_database()');
    console.log('✅ Current user:', userResult.rows[0].current_user);
    console.log('✅ Current database:', userResult.rows[0].current_database);
    
    client.release();
    await pool.end();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testConnection();
