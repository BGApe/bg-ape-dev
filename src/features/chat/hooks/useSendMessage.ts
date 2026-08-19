import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { mapError } from '@/lib/mapError';
import { mockAssistantProvider } from '@/modules/assistant/MockAssistantProvider';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';
import { useComposerStore } from '@/store/composerStore';
import type { MessageId } from '@/types';

import { chatRepository } from '../api/activeChatRepository';
import { runAssistantTurn } from '../services/assistantOrchestrator';
import type { ChatMessage, ChatThread } from '../types';

export function useSendMessage(thread: ChatThread | null) {
  const queryClient = useQueryClient();
  const appendStreamChunk = useComposerStore((s) => s.appendStreamChunk);
  const clearStream = useComposerStore((s) => s.clearStream);

  return useMutation({
    mutationFn: async (text: string) => {
      if (!thread) throw new Error('No active thread.');
      const uid = thread.userId;

      const existingMessages =
        queryClient.getQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id)) ?? [];
      const isFirstMessage = existingMessages.filter((m) => m.role === 'user').length === 0;

      const optimisticMessage: ChatMessage = {
        id: `optimistic-${Date.now()}` as MessageId,
        threadId: thread.id,
        role: 'user',
        content: text,
        createdAt: Date.now(),
        isOptimistic: true,
      };

      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) => [
        ...(prev ?? []),
        optimisticMessage,
      ]);

      const userMessage = await chatRepository.addMessage(uid, thread.id, {
        threadId: thread.id,
        role: 'user',
        content: text,
        createdAt: Date.now(),
      });

      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) =>
        (prev ?? []).map((m) => (m.id === optimisticMessage.id ? userMessage : m)),
      );

      const assistantMessages = await runAssistantTurn(
        text,
        thread.id,
        uid,
        mockAssistantProvider,
        chatRepository,
        { appendStreamChunk, clearStream },
        thread.reason,
        isFirstMessage,
      );

      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) => [
        ...(prev ?? []),
        ...assistantMessages,
      ]);

      void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.threads(uid) });
      firebaseAnalytics.track('message_sent', { intent: 'unknown' });

      return assistantMessages;
    },

    onError(error) {
      clearStream();
      const mapped = mapError(error);
      logger.captureException(error, { mapped });
    },
  });
}
