import { Redirect, Stack } from 'expo-router';

import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

/**
 * Authenticated route group. Redirects to login if the user is not signed in.
 * All children of this group receive a guaranteed non-null session via useAuthSession().
 */
export default function AppLayout(): React.JSX.Element | null {
  const { status } = useAuthSession();

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Redirect href="/(public)/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
