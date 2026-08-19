import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { chatRepository } from '../api/activeChatRepository';

export function useThreads() {
  const { user } = useAuthSession();

  return useQuery({
    queryKey: user ? QueryKeys.chat.threads(user.uid) : QueryKeys.chat.threads('none'),
    queryFn: () => {
      if (!user) return [];
      return chatRepository.listThreads(user.uid);
    },
    enabled: !!user,
  });
}
