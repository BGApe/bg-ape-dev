import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { MessageId } from '@/types';

import { chatRepository } from '../api/activeChatRepository';
import type { ChatMessage, ChatThread } from '../types';

export function useDeleteMessage(thread: ChatThread | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: MessageId) => {
      if (!thread) return Promise.reject(new Error('No active thread.'));
      return chatRepository.deleteMessage(thread.userId, thread.id, messageId);
    },

    onMutate: (messageId: MessageId) => {
      if (!thread) return;
      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) =>
        (prev ?? []).filter((m) => m.id !== messageId),
      );
    },

    onError(error) {
      if (thread) {
        void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.messages(thread.id) });
      }
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
