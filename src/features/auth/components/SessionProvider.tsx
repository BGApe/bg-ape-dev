import type React from 'react';
import { useEffect } from 'react';

import { firestoreUserProfileRepository } from '@/features/account/api/FirestoreUserProfileRepository';
import { logger } from '@/services/logger';
import { useSessionStore } from '@/store/sessionStore';

import { firebaseAuthProvider } from '../api/FirebaseAuthProvider';

type Props = { children: React.ReactNode };

/**
 * Subscribes to Firebase Auth state changes and syncs them into the
 * Zustand session store. Must be rendered inside RootProviders.
 *
 * Also calls createOrMerge on every sign-in to ensure a Firestore profile
 * exists — the operation is idempotent via setDoc({ merge: true }).
 */
export function SessionProvider({ children }: Props): React.JSX.Element {
  const setUser = useSessionStore((s) => s.setUser);
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    const unsubscribe = firebaseAuthProvider.onSessionChange((user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        const profileData =
          user.displayName !== null
            ? { email: user.email, displayName: user.displayName }
            : { email: user.email };

        firestoreUserProfileRepository
          .createOrMerge(user.uid, profileData)
          .catch((err: unknown) => {
            logger.warn('[SessionProvider] createOrMerge failed', { err });
          });
      }
    });
    return unsubscribe;
  }, [setUser, setLoading]);

  return <>{children}</>;
}
