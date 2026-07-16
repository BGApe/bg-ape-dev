import type { ConfigContext, ExpoConfig } from 'expo/config';

// Firestore region: europe-west10 (Berlin). Cloud Functions may fall back to
// europe-west1 if Gen 2 is unavailable in europe-west10 at deploy time.
const IS_PRODUCTION = process.env.EXPO_PUBLIC_ENV === 'production';
const IS_STAGING = process.env.EXPO_PUBLIC_ENV === 'staging';

function getAppName(): string {
  if (IS_STAGING) return 'BG Ape (Staging)';
  if (!IS_PRODUCTION) return 'BG Ape (Dev)';
  return 'BG Ape';
}

function getAppId(): string {
  if (IS_STAGING) return 'com.v1.boardgameapp.staging';
  if (!IS_PRODUCTION) return 'com.v1.boardgameapp.dev';
  return 'com.v1.boardgameapp';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: 'bgape',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'bgape',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0F0F0F',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0F0F0F',
    },
    package: getAppId(),
    googleServicesFile: './google-services.json',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    // @react-native-firebase config plugins wire google-services.json and
    // Gradle dependencies into the Android native project during expo prebuild.
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    ['@react-native-firebase/app-check', { isTokenAutoRefreshEnabled: true }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // EAS project ID is added after running `eas init` in Phase 4.
    eas: {
      projectId: 'REPLACE_AFTER_EAS_INIT',
    },
  },
});
