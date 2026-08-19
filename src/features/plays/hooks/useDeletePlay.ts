import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { PlayId } from '@/types';

import { firestorePlaysRepository } from '../api/FirestorePlaysRepository';

export function useDeletePlay() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (playId: PlayId) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestorePlaysRepository.remove(user.uid, playId);
    },

    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.plays.list(user.uid) });
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
