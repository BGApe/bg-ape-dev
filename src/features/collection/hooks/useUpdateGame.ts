import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { GameId } from '@/types';

import { firestoreCollectionRepository } from '../api/FirestoreCollectionRepository';
import type { CollectionGame, CollectionGamePatch } from '../types';

export function useUpdateGame() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (args: { gameId: GameId; patch: CollectionGamePatch }) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreCollectionRepository.update(user.uid, args.gameId, args.patch);
    },

    // Optimistically apply so inline note edits feel instant.
    onMutate: (args: { gameId: GameId; patch: CollectionGamePatch }) => {
      if (!user) return;
      queryClient.setQueryData<CollectionGame[]>(QueryKeys.collection.list(user.uid), (prev) =>
        (prev ?? []).map((g) => (g.id === args.gameId ? { ...g, ...args.patch } : g)),
      );
    },

    onError(error) {
      if (user) {
        void queryClient.invalidateQueries({ queryKey: QueryKeys.collection.list(user.uid) });
      }
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
