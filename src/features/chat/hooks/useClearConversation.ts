import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';

import { chatRepository } from '../api/activeChatRepository';
import type { ChatMessage, ChatThread } from '../types';

export function useClearConversation(thread: ChatThread | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!thread) return Promise.reject(new Error('No active thread.'));
      return chatRepository.clearMessages(thread.userId, thread.id);
    },

    onSuccess() {
      if (!thread) return;
      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), []);
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
