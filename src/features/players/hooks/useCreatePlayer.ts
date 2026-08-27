import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';

import { firestorePlayersRepository } from '../api/FirestorePlayersRepository';
import type { NewPlayer } from '../types';

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (player: NewPlayer) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestorePlayersRepository.add(user.uid, player);
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
