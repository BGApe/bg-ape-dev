import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { mockAssistantProvider } from '@/modules/assistant/MockAssistantProvider';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';
import { useComposerStore } from '@/store/composerStore';
import type { MessageId, ThreadId } from '@/types';

import { inMemoryChatRepository } from '../api/InMemoryChatRepository';
import { runAssistantTurn } from '../services/assistantOrchestrator';
import type { ChatMessage } from '../types';

import { useChatThread } from './useChatThread';

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const { thread } = useChatThread();
  const appendStreamChunk = useComposerStore((s) => s.appendStreamChunk);
  const clearStream = useComposerStore((s) => s.clearStream);

  return useMutation({
    mutationFn: async (text: string) => {
      if (!user || !thread) throw new Error('Not authenticated or no active thread.');

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

      const userMessage = await inMemoryChatRepository.addMessage(thread.id, {
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
        thread.id as ThreadId,
        user.uid,
        mockAssistantProvider,
        inMemoryChatRepository,
        { appendStreamChunk, clearStream },
      );

      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) => [
        ...(prev ?? []),
        ...assistantMessages,
      ]);

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
