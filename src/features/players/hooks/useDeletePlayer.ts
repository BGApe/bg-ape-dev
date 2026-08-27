import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { PlayerId } from '@/types';

import { firestorePlayersRepository } from '../api/FirestorePlayersRepository';

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (playerId: PlayerId) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestorePlayersRepository.remove(user.uid, playerId);
    },
    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.players.list(user.uid) });
    },
    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
