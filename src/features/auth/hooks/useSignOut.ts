import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';

import { firebaseAuthProvider } from '../api/FirebaseAuthProvider';

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => firebaseAuthProvider.signOut(),

    onSuccess() {
      // Clear all cached server data on sign-out.
      queryClient.removeQueries({ queryKey: QueryKeys.user.all });
      queryClient.removeQueries({ queryKey: QueryKeys.chat.all });
    },

    onError(error) {
      logger.captureException(error, mapError(error));
    },
  });
}
