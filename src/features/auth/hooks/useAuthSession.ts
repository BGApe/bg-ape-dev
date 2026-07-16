import { useSessionStore } from '@/store/sessionStore';

import type { AuthStatus } from '../types';

/**
 * Primary auth session hook. Use this in layouts and screens.
 * Backed by Zustand; populated by SessionProvider listening to Firebase Auth.
 */
export function useAuthSession() {
  const user = useSessionStore((s) => s.user);
  const isLoading = useSessionStore((s) => s.isLoading);

  const status: AuthStatus = isLoading ? 'loading' : user ? 'authenticated' : 'unauthenticated';

  return { user, isLoading, status };
}
