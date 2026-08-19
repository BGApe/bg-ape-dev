import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';

import { firestoreCollectionRepository } from '../api/FirestoreCollectionRepository';
import type { NewCollectionGame } from '../types';

export function useAddGame() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (game: NewCollectionGame) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreCollectionRepository.add(user.uid, game);
    },

    onSuccess(_result, variables) {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.collection.list(user.uid) });
      firebaseAnalytics.track('game_added', { source: variables.source });
    },

    onError(error) {
      const mapped = mapError(error);
      logger.captureException(error, { mapped });
    },
  });
}
