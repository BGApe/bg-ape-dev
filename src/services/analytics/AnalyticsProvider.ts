import type { UserId } from '@/types';

/**
 * Analytics interface. Feature code calls this; never calls Firebase Analytics directly.
 * No-op implementation used in tests; FirebaseAnalyticsProvider used at runtime.
 */
export interface AnalyticsProvider {
  track(event: string, properties?: Record<string, unknown>): void;
  identify(uid: UserId, traits?: Record<string, unknown>): void;
  screen(name: string, properties?: Record<string, unknown>): void;
}

export const noopAnalytics: AnalyticsProvider = {
  track: () => undefined,
  identify: () => undefined,
  screen: () => undefined,
};
