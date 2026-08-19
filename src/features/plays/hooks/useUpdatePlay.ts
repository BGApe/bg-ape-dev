import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { PlayId } from '@/types';

import { firestorePlaysRepository } from '../api/FirestorePlaysRepository';
import type { Play, PlayPatch } from '../types';

export function useUpdatePlay() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (args: { playId: PlayId; patch: PlayPatch }) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestorePlaysRepository.update(user.uid, args.playId, args.patch);
    },

    // Optimistically apply the patch so inline edits feel instant.
    onMutate: (args: { playId: PlayId; patch: PlayPatch }) => {
      if (!user) return;
      queryClient.setQueryData<Play[]>(QueryKeys.plays.list(user.uid), (prev) =>
        (prev ?? []).map((p) => (p.id === args.playId ? { ...p, ...args.patch } : p)),
      );
    },

    onError(error) {
      if (user) {
        void queryClient.invalidateQueries({ queryKey: QueryKeys.plays.list(user.uid) });
      }
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
