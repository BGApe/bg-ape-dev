import { useMutation } from '@tanstack/react-query';

import { mapError } from '@/lib/mapError';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';

import { firebaseAuthProvider } from '../api/FirebaseAuthProvider';

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      firebaseAuthProvider.signIn(email, password),

    onSuccess(user) {
      firebaseAnalytics.identify(user.uid);
      firebaseAnalytics.track('sign_in', { method: 'email' });
    },

    onError(error) {
      const mapped = mapError(error);
      logger.captureException(error, { mapped });
    },
  });
}
