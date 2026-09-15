import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { PlayerId } from '@/types';

import { firestorePlayersRepository } from '../api/FirestorePlayersRepository';
import type { Player, PlayerPatch } from '../types';

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (args: { playerId: PlayerId; patch: PlayerPatch }) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestorePlayersRepository.update(user.uid, args.playerId, args.patch);
    },
    onMutate: (args: { playerId: PlayerId; patch: PlayerPatch }) => {
      if (!user) return;
      const key = QueryKeys.players.list(user.uid);
      const previous = queryClient.getQueryData<Player[]>(key);
      queryClient.setQueryData<Player[]>(key, (prev) =>
        (prev ?? []).map((p) => (p.id === args.playerId ? { ...p, ...args.patch } : p)),
      );
      return { previous, key };
    },
    onError(error, _args, context) {
      if (context?.previous !== undefined && context.key !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      logger.captureException(error, { mapped: mapError(error) });
    },
    onSettled() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.players.list(user.uid) });
    },
  });
}
