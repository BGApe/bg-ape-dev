/* eslint-disable no-console */
import type { LoggerProvider } from './LoggerProvider';

export const ConsoleLogger: LoggerProvider = {
  debug: (msg, ctx) => console.debug(`[DEBUG] ${msg}`, ctx ?? ''),
  info: (msg, ctx) => console.info(`[INFO] ${msg}`, ctx ?? ''),
  warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx ?? ''),
  error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx ?? ''),
  captureException: (err, ctx) => console.error('[EXCEPTION]', err, ctx ?? ''),
};
