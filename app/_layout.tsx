import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { RootProviders } from '@/providers/RootProviders';

/**
 * Root layout: mounts providers, registers the root Stack navigator.
 * Phase 2: Firebase + App Check init, Sentry error boundary go here.
 */
export default function RootLayout(): React.JSX.Element {
  return (
    <RootProviders>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </RootProviders>
  );
}
