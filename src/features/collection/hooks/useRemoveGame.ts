import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { GameId } from '@/types';

import { firestoreCollectionRepository } from '../api/FirestoreCollectionRepository';

export function useRemoveGame() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (gameId: GameId) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreCollectionRepository.remove(user.uid, gameId);
    },

    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.collection.list(user.uid) });
    },

    onError(error) {
      const mapped = mapError(error);
      logger.captureException(error, { mapped });
    },
  });
}
