import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { firestoreLocationsRepository } from '../api/FirestoreLocationsRepository';

export function useLocations() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.locations.list(user.uid) : QueryKeys.locations.list('none'),
    queryFn: () => {
      if (!user) return [];
      return firestoreLocationsRepository.list(user.uid);
    },
    enabled: !!user,
  });
}
