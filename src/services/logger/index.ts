import { env } from '@/config/env';

import { ConsoleLogger } from './ConsoleLogger';
import { SentryLogger } from './SentryLogger';

export type { LoggerProvider } from './LoggerProvider';
export { initSentry } from './SentryLogger';

/**
 * Singleton logger. Use this throughout the codebase.
 * Automatically selects SentryLogger in staging/production,
 * ConsoleLogger in development.
 */
export const logger = env.EXPO_PUBLIC_ENV === 'development' ? ConsoleLogger : SentryLogger;
