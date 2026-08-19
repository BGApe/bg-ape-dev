import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';

import { firestorePlaysRepository } from '../api/FirestorePlaysRepository';
import type { NewPlay } from '../types';

export function useLogPlay() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (play: NewPlay) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestorePlaysRepository.add(user.uid, play);
    },

    onSuccess(_result, variables) {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.plays.list(user.uid) });
      firebaseAnalytics.track('play_logged', { fromCollection: variables.gameId !== undefined });
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
