import { useMutation, useQueryClient } from '@tanstack/react-query';

import appConfig from '@/config/appConfig';
import { QueryKeys } from '@/constants/queryKeys';
import {
  buildCollectionContext,
  detectActivityBias,
} from '@/features/assistant/lib/collectionContext';
import { buildConversationHistory } from '@/features/assistant/lib/conversationHistory';
import type { ActivityBias } from '@/features/assistant/types';
import type { CollectionGame } from '@/features/collection/types';
import type { Play } from '@/features/plays/types';
import { mapError } from '@/lib/mapError';
import { activeAssistantProvider } from '@/modules/assistant/activeAssistantProvider';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';
import { useComposerStore } from '@/store/composerStore';
import type { MessageId } from '@/types';

import { chatRepository } from '../api/activeChatRepository';
import { runAssistantTurn } from '../services/assistantOrchestrator';
import type { ChatMessage, ChatThread } from '../types';

function resolveActivityBias(messages: ChatMessage[], currentText: string): ActivityBias {
  const fromCurrent = detectActivityBias(currentText);
  if (fromCurrent !== 'none') return fromCurrent;
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const bias = detectActivityBias(m.content);
    if (bias !== 'none') return bias;
  }
  return 'none';
}

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

      // History from messages that existed before this turn (excludes current text).
      const recentMessages = buildConversationHistory(
        existingMessages,
        appConfig.assistant.conversationHistoryLevel,
      );

      const recommendationExtras =
        thread.reason === 'recommendation'
          ? (() => {
              const games =
                queryClient.getQueryData<CollectionGame[]>(QueryKeys.collection.list(uid)) ?? [];
              const plays = queryClient.getQueryData<Play[]>(QueryKeys.plays.list(uid)) ?? [];
              const collectionContext = buildCollectionContext(
                games,
                plays,
                appConfig.assistant.collectionContextLevel,
              );
              const activityBias = resolveActivityBias(existingMessages, text);
              return {
                collectionContext,
                activityBias,
              };
            })()
          : {};

      const assistantMessages = await runAssistantTurn(
        text,
        thread.id,
        uid,
        activeAssistantProvider,
        chatRepository,
        { appendStreamChunk, clearStream },
        thread.reason,
        isFirstMessage,
        {
          ...recommendationExtras,
          recentMessages,
        },
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
