import { envSchema, type Env } from './env';

/**
 * Validates and returns typed environment configuration
 */
export function loadConfiguration(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

/**
 * Global configuration object
 */
export const config = loadConfiguration();
