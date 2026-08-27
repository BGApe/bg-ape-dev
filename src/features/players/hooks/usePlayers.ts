import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { firestorePlayersRepository } from '../api/FirestorePlayersRepository';

export function usePlayers() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.players.list(user.uid) : QueryKeys.players.list('none'),
    queryFn: () => {
      if (!user) return [];
      return firestorePlayersRepository.list(user.uid);
    },
    enabled: !!user,
  });
}
