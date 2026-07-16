import { Redirect, Stack } from 'expo-router';

import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

/**
 * Public route group. Redirects to the app if the user is already signed in.
 * Shows nothing (null) while the auth state is still loading to avoid flicker.
 */
export default function PublicLayout(): React.JSX.Element | null {
  const { status } = useAuthSession();

  if (status === 'loading') return null;
  if (status === 'authenticated') return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
