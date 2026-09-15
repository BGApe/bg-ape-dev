import { Redirect, Stack } from 'expo-router';
import type React from 'react';

import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { useEnsureSelfPlayer } from '@/features/players/hooks/useEnsureSelfPlayer';

/**
 * Authenticated route group. Redirects to login if the user is not signed in.
 * Uses a Stack so that screens like game / plays / player are properly pushed
 * on top of the tab bar and pressing back returns to the originating tab.
 */
export default function AppLayout(): React.JSX.Element | null {
  const { status } = useAuthSession();
  useEnsureSelfPlayer();

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Redirect href="/(public)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The (tabs) group renders the bottom tab bar */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Stack-only screens — no tab bar shown */}
      <Stack.Screen name="game" options={{ headerShown: false }} />
      <Stack.Screen name="plays" options={{ headerShown: false }} />
      <Stack.Screen name="stats" options={{ headerShown: false }} />
      <Stack.Screen name="intent" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ headerShown: false }} />
    </Stack>
  );
}
