import { useMutation, useQueryClient } from '@tanstack/react-query';

import appConfig from '@/config/appConfig';
import { QueryKeys } from '@/constants/queryKeys';
import {
  buildCollectionContext,
  buildGameContext,
  detectActivityBias,
  detectSetupDepth,
} from '@/features/assistant/lib/collectionContext';
import { buildConversationHistory } from '@/features/assistant/lib/conversationHistory';
import type {
  ActivityBias,
  CollectionGameContextItem,
  SetupDepth,
} from '@/features/assistant/types';
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

function resolveSetupDepth(messages: ChatMessage[], currentText: string): SetupDepth | undefined {
  const fromCurrent = detectSetupDepth(currentText);
  if (fromCurrent !== undefined) return fromCurrent;
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const depth = detectSetupDepth(m.content);
    if (depth !== undefined) return depth;
  }
  return undefined;
}

function resolveGameFromThread(
  thread: ChatThread,
  games: CollectionGame[],
): CollectionGame | undefined {
  if (thread.gameId !== undefined) {
    return games.find((g) => g.id === thread.gameId);
  }
  if (thread.gameName !== undefined && thread.gameName.trim().length > 0) {
    const name = thread.gameName.trim().toLowerCase();
    return games.find((g) => g.name.toLowerCase() === name);
  }
  return undefined;
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

      const games =
        queryClient.getQueryData<CollectionGame[]>(QueryKeys.collection.list(uid)) ?? [];

      const recommendationExtras =
        thread.reason === 'recommendation'
          ? (() => {
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

      let gameContext: CollectionGameContextItem | undefined;
      let setupDepth: SetupDepth | undefined;
      if (thread.reason === 'setup' || thread.reason === 'rules') {
        const game = resolveGameFromThread(thread, games);
        if (game !== undefined) {
          const built = buildGameContext(game);
          if (built !== null) gameContext = built;
        }
        if (thread.reason === 'setup') {
          setupDepth = resolveSetupDepth(existingMessages, text) ?? 'basic';
        }
      }

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
          ...(gameContext !== undefined ? { gameContext } : {}),
          ...(setupDepth !== undefined ? { setupDepth } : {}),
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
