import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
  /**
   * BGG developer API token — obtained from https://boardgamegeek.com/xmlapi2.
   * Optional: the public XML API2 works without it, but the token raises rate
   * limits and may unlock authenticated endpoints in the future.
   * Store in .env.local (gitignored) — never commit to version control.
   */
  EXPO_PUBLIC_BGG_TOKEN: z.string().uuid().optional(),
});

/**
 * Validated environment variables. Throws at app boot if required vars are missing
 * or malformed — fail-fast beats silent misconfiguration.
 */
export const env = envSchema.parse({
  EXPO_PUBLIC_ENV: process.env['EXPO_PUBLIC_ENV'],
  EXPO_PUBLIC_SENTRY_DSN: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  EXPO_PUBLIC_BGG_TOKEN: process.env['EXPO_PUBLIC_BGG_TOKEN'],
});

export type Env = z.infer<typeof envSchema>;
