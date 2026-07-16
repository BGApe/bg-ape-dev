import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

import { inMemoryChatRepository } from '../api/InMemoryChatRepository';

export function useChatThread() {
  const { user } = useAuthSession();

  const query = useQuery({
    queryKey: user ? QueryKeys.chat.threads(user.uid) : QueryKeys.chat.threads('none'),
    queryFn: () => {
      if (!user) return null;
      return inMemoryChatRepository.getOrCreateThread(user.uid);
    },
    enabled: !!user,
  });

  return { thread: query.data ?? null, isLoading: query.isLoading };
}
