import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { logger } from '@/services/logger';

import { firestorePlayersRepository } from '../api/FirestorePlayersRepository';
import type { Player } from '../types';

import { usePlayers } from './usePlayers';

const DEFAULT_SELF_NAME = 'Me';

/**
 * Ensures a dedicated self player (`isSelf: true`) exists for the signed-in user.
 * Creates one named "Me" when missing. Safe to mount once under the app shell.
 */
export function useEnsureSelfPlayer(): Player | undefined {
  const { user } = useAuthSession();
  const { data: players = [], isSuccess } = usePlayers();
  const queryClient = useQueryClient();
  const creating = useRef(false);

  const self = players.find((p) => p.isSelf === true);

  useEffect(() => {
    if (!user || !isSuccess || self !== undefined || creating.current) return;

    creating.current = true;
    void firestorePlayersRepository
      .add(user.uid, { name: DEFAULT_SELF_NAME, isSelf: true })
      .then((created) => {
        queryClient.setQueryData<Player[]>(QueryKeys.players.list(user.uid), (prev) => [
          ...(prev ?? []),
          created,
        ]);
        void queryClient.invalidateQueries({ queryKey: QueryKeys.players.list(user.uid) });
      })
      .catch((err: unknown) => {
        logger.warn('[useEnsureSelfPlayer] failed to create self player', { err });
      })
      .finally(() => {
        creating.current = false;
      });
  }, [user, isSuccess, self, queryClient]);

  return self;
}
