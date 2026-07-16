import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
});

/**
 * Validated environment variables. Throws at app boot if required vars are missing
 * or malformed — fail-fast beats silent misconfiguration.
 */
export const env = envSchema.parse({
  EXPO_PUBLIC_ENV: process.env['EXPO_PUBLIC_ENV'],
  EXPO_PUBLIC_SENTRY_DSN: process.env['EXPO_PUBLIC_SENTRY_DSN'],
});

export type Env = z.infer<typeof envSchema>;
