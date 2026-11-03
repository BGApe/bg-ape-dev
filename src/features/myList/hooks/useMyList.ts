import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { firestoreMyListRepository } from '../api/FirestoreMyListRepository';

export function useMyList() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.myList.list(user.uid) : QueryKeys.myList.list('none'),
    queryFn: () => {
      if (!user) return [];
      return firestoreMyListRepository.list(user.uid);
    },
    enabled: !!user,
  });
}
