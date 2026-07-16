import * as Sentry from '@sentry/react-native';

import { env } from '@/config/env';

import { ConsoleLogger } from './ConsoleLogger';
import type { LoggerProvider } from './LoggerProvider';

/**
 * Initialises Sentry. Call once at app boot before rendering.
 * No-ops gracefully when EXPO_PUBLIC_SENTRY_DSN is absent.
 */
export function initSentry(): void {
  if (!env.EXPO_PUBLIC_SENTRY_DSN) return;

  Sentry.init({
    dsn: env.EXPO_PUBLIC_SENTRY_DSN,
    environment: env.EXPO_PUBLIC_ENV,
    // Disable in development to avoid noise; enable in staging/production.
    enabled: env.EXPO_PUBLIC_ENV !== 'development',
    tracesSampleRate: env.EXPO_PUBLIC_ENV === 'production' ? 0.2 : 1.0,
  });
}

/**
 * Production logger — routes to Sentry when DSN is configured,
 * falls back to ConsoleLogger otherwise.
 */
export const SentryLogger: LoggerProvider = {
  debug: ConsoleLogger.debug,
  info: ConsoleLogger.info,
  warn: ConsoleLogger.warn,

  error(message, context) {
    ConsoleLogger.error(message, context);
    if (env.EXPO_PUBLIC_SENTRY_DSN) {
      // Conditionally spread extra to satisfy exactOptionalPropertyTypes.
      Sentry.captureMessage(
        message,
        context !== undefined
          ? { level: 'error' as const, extra: context }
          : { level: 'error' as const },
      );
    }
  },

  captureException(error, context) {
    ConsoleLogger.captureException(error, context);
    if (env.EXPO_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, context !== undefined ? { extra: context } : undefined);
    }
  },
};
