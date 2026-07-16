/**
 * Firebase configuration stub — wired in Phase 2.
 *
 * @react-native-firebase reads credentials from:
 *   - android/app/google-services.json  (Android)
 *   - ios/GoogleService-Info.plist       (iOS)
 *
 * No Firebase API keys belong in JS environment variables when using the
 * native SDK. This file will export the initialized default app in Phase 2.
 *
 * TODO Phase 2: Add firebase app initialization and App Check setup here.
 */

// Firestore database region. Cloud Functions will match unless europe-west10
// lacks Gen 2 support at deploy time — fallback to europe-west1 (Belgium).
export const FIREBASE_REGION = 'europe-west10' as const;
export const FUNCTIONS_REGION = 'europe-west10' as const;
