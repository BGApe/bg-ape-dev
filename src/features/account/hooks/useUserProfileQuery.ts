import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { firestoreUserProfileRepository } from '../api/FirestoreUserProfileRepository';

export function useUserProfileQuery() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.user.profile(user.uid) : ['user', 'profile', 'none'],
    queryFn: () => {
      if (!user) return null;
      return firestoreUserProfileRepository.get(user.uid);
    },
    enabled: !!user,
  });
}
