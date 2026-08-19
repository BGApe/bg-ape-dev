import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';

import { chatRepository } from '../api/activeChatRepository';
import type { ChatThread } from '../types';

export function useChatMessages(thread: ChatThread | null) {
  return useQuery({
    queryKey: thread ? QueryKeys.chat.messages(thread.id) : QueryKeys.chat.messages('none'),
    queryFn: () => {
      if (!thread) return [];
      return chatRepository.getMessages(thread.userId, thread.id);
    },
    enabled: thread !== null,
  });
}
