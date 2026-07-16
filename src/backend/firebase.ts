import appCheck from '@react-native-firebase/app-check';

import { logger } from '@/services/logger';

let initialized = false;

/**
 * Initialises Firebase App Check. Called once at app boot in RootProviders.
 * - Development / debug builds: debug provider (token printed to Android logs
 *   on first run — paste it into Firebase console → App Check → debug tokens).
 * - Production builds: Play Integrity provider.
 *
 * Idempotent: safe to call multiple times.
 */
export async function initFirebase(): Promise<void> {
  if (initialized) return;

  try {
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
      },
    });

    await appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    initialized = true;
  } catch (error) {
    // Non-fatal: App Check token will be absent and Firebase Security Rules
    // will reject LLM callable requests until this is resolved.
    logger.warn('[Firebase] App Check init failed', { error });
  }
}
