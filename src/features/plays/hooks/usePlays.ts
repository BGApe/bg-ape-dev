import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { firestorePlaysRepository } from '../api/FirestorePlaysRepository';

export function usePlays() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.plays.list(user.uid) : QueryKeys.plays.list('none'),
    queryFn: () => {
      if (!user) return [];
      return firestorePlaysRepository.list(user.uid);
    },
    enabled: !!user,
  });
}
