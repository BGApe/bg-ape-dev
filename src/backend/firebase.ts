import appCheck from '@react-native-firebase/app-check';

import { env } from '@/config/env';
import { logger } from '@/services/logger';

let initialized = false;

/**
 * Initialises Firebase App Check. Called once at app boot in RootProviders.
 * - Development / debug builds: debug provider (prefer a fixed UUID from
 *   EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN registered in Firebase Console).
 * - Production builds: Play Integrity provider.
 *
 * Idempotent: safe to call multiple times.
 */
export async function initFirebase(): Promise<void> {
  if (initialized) return;

  try {
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    const debugToken = env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;

    provider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        ...(__DEV__ && debugToken !== undefined ? { debugToken } : {}),
      },
    });

    await appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    if (__DEV__) {
      try {
        await appCheck().getToken(true);
        logger.info('[Firebase] App Check token acquired', {
          hasFixedDebugToken: debugToken !== undefined,
        });
      } catch (tokenError) {
        logger.warn('[Firebase] App Check getToken failed', { error: tokenError });
      }
    }

    initialized = true;
  } catch (error) {
    // Non-fatal: App Check token will be absent and Firebase Security Rules
    // will reject LLM callable requests until this is resolved.
    logger.warn('[Firebase] App Check init failed', { error });
  }
}
