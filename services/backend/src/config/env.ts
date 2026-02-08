import { z } from 'zod';

/**
 * Environment variables schema with Zod validation
 */
export const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server
  PORT: z.string().default('3000').transform(Number),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // Payment providers
  SHOPIER_API_KEY: z.string().optional(),
  SHOPIER_API_SECRET: z.string().optional(),
  SHOPIER_CALLBACK_URL: z.string().url().optional(),
  
  // Stripe (future)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Expo push notifications
  EXPO_ACCESS_TOKEN: z.string().optional(),
  
  // Observability
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  
  // Features flags
  ENABLE_ANALYTICS: z.string().default('true').transform((v) => v === 'true'),
  ENABLE_NOTIFICATIONS: z.string().default('true').transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;
