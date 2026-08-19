import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { firestoreCollectionRepository } from '../api/FirestoreCollectionRepository';

export function useCollection() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.collection.list(user.uid) : QueryKeys.collection.list('none'),
    queryFn: () => {
      if (!user) return [];
      return firestoreCollectionRepository.list(user.uid);
    },
    enabled: !!user,
  });
}
