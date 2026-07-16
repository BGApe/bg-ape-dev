/**
 * Logger interface. All catch blocks and observability call sites use this.
 * Concrete implementations: ConsoleLogger (dev/test), SentryLogger (production).
 * Neither implementation is imported directly by feature code — use the
 * singleton exported from src/services/logger/index.ts.
 */
export interface LoggerProvider {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
}
