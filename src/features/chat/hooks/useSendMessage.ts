import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

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
import { rulesFamilyNote, setupDepthNote } from '../lib/replyPrompts';
import { previouslySuggestedGames } from '../lib/suggestedGames';
import { runAssistantTurn } from '../services/assistantOrchestrator';
import type { ChatMessage, ChatThread } from '../types';

const DUPLICATE_WINDOW_MS = 15_000;
const turnsInFlight = new Set<string>();

export type OutboundMessage = {
  text: string;
  label?: string;
  segmentId?: string;
  segmentTitle?: string;
  parentSegmentId?: string;
  discussionId?: string;
  discussionTitle?: string;
  discussionKind?: 'setup' | 'rules';
  versionName?: string;
  playerCount?: string;
  /** Setup or rules behaviour for this turn when the thread itself is the game chat. */
  turnReason?: 'setup' | 'rules';
};

function discussionStamp(input: string | OutboundMessage): Partial<OutboundMessage> {
  if (typeof input === 'string') return {};
  const stamp: Partial<OutboundMessage> = {};
  if (input.discussionId !== undefined) stamp.discussionId = input.discussionId;
  if (input.discussionTitle !== undefined) stamp.discussionTitle = input.discussionTitle;
  if (input.discussionKind !== undefined) stamp.discussionKind = input.discussionKind;
  if (input.versionName !== undefined) stamp.versionName = input.versionName;
  if (input.playerCount !== undefined) stamp.playerCount = input.playerCount;
  if (input.parentSegmentId !== undefined) stamp.parentSegmentId = input.parentSegmentId;
  return stamp;
}

function isDuplicateTurn(messages: ChatMessage[], text: string): boolean {
  const last = messages[messages.length - 1];
  if (last?.role === 'user' && last.content === text) return true;
  if (last?.role !== 'assistant') return false;
  const priorUser = [...messages].reverse().find((message) => message.role === 'user');
  if (priorUser?.content !== text) return false;
  return Date.now() - last.createdAt < DUPLICATE_WINDOW_MS;
}

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const merged = [...prev];
  for (const message of incoming) {
    if (merged.some((existing) => existing.id === message.id)) continue;
    const last = merged[merged.length - 1];
    if (last !== undefined && last.role === message.role && last.content === message.content) {
      continue;
    }
    merged.push(message);
  }
  return merged;
}

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
  const sendingRef = useRef(false);

  return useMutation({
    mutationFn: async (input: string | OutboundMessage) => {
      if (!thread) throw new Error('No active thread.');
      if (sendingRef.current || turnsInFlight.has(thread.id)) return [];
      const text = typeof input === 'string' ? input : input.text;
      const label = typeof input === 'string' ? undefined : input.label?.trim();
      const segmentId = typeof input === 'string' ? undefined : input.segmentId;
      const segmentTitle = typeof input === 'string' ? undefined : input.segmentTitle;
      const discussionId = typeof input === 'string' ? undefined : input.discussionId;
      const turnReason =
        typeof input === 'string' ? undefined : (input.turnReason ?? input.discussionKind);
      const stamp = discussionStamp(input);
      const uid = thread.userId;
      const existingMessages =
        queryClient.getQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id)) ?? [];
      const scopedMessages =
        discussionId !== undefined
          ? existingMessages.filter(
              (message) => (message.discussionId ?? 'legacy') === discussionId,
            )
          : existingMessages;
      if (isDuplicateTurn(scopedMessages, text)) return [];

      sendingRef.current = true;
      turnsInFlight.add(thread.id);
      try {
        const live =
          queryClient
            .getQueryData<ChatThread[]>(QueryKeys.chat.threads(uid))
            ?.find((item) => item.id === thread.id) ?? thread;
        const isFirstMessage = scopedMessages.filter((m) => m.role === 'user').length === 0;

        const optimisticMessage: ChatMessage = {
          id: `optimistic-${Date.now()}` as MessageId,
          threadId: thread.id,
          role: 'user',
          content: text,
          createdAt: Date.now(),
          ...(label !== undefined && label.length > 0 ? { label } : {}),
          ...(segmentId !== undefined && segmentId.length > 0 ? { segmentId } : {}),
          ...(segmentTitle !== undefined && segmentTitle.length > 0 ? { segmentTitle } : {}),
          ...stamp,
          isOptimistic: true,
        };

        queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) =>
          mergeMessages(prev ?? [], [optimisticMessage]),
        );

        const userMessage = await chatRepository.addMessage(uid, thread.id, {
          threadId: thread.id,
          role: 'user',
          content: text,
          createdAt: Date.now(),
          ...(label !== undefined && label.length > 0 ? { label } : {}),
          ...(segmentId !== undefined && segmentId.length > 0 ? { segmentId } : {}),
          ...(segmentTitle !== undefined && segmentTitle.length > 0 ? { segmentTitle } : {}),
          ...stamp,
        });

        queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) => {
          const list = prev ?? [];
          if (!list.some((message) => message.id === optimisticMessage.id)) {
            return mergeMessages(list, [userMessage]);
          }
          return list.map((message) =>
            message.id === optimisticMessage.id ? userMessage : message,
          );
        });

        // History from messages that existed before this turn (excludes current text).
        const recentMessages = buildConversationHistory(
          scopedMessages,
          appConfig.assistant.conversationHistoryLevel,
        );

        const games =
          queryClient.getQueryData<CollectionGame[]>(QueryKeys.collection.list(uid)) ?? [];

        const reason = turnReason ?? live.reason;
        const recommendationExtras =
          reason === 'recommendation'
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
        let focusedGame: CollectionGame | undefined;
        if (reason === 'setup' || reason === 'rules') {
          const versionName = typeof input === 'string' ? undefined : input.versionName;
          const versionGame =
            versionName !== undefined
              ? games.find((game) => game.name.toLowerCase() === versionName.toLowerCase())
              : undefined;
          const game = versionGame ?? resolveGameFromThread(live, games);
          focusedGame = game;
          if (game !== undefined) {
            const built = buildGameContext(game);
            if (built !== null) gameContext = built;
          }
          if (reason === 'setup') {
            setupDepth = resolveSetupDepth(existingMessages, text) ?? 'basic';
          }
        }

        const depthOnThisTurn = reason === 'setup' ? detectSetupDepth(text) : undefined;
        const modelText =
          reason === 'rules'
            ? `${text}\n\n${rulesFamilyNote(focusedGame, games)}`
            : depthOnThisTurn !== undefined
              ? `${text}\n\n${setupDepthNote(depthOnThisTurn)}`
              : text;

        const assistantMessages = await runAssistantTurn(
          modelText,
          thread.id,
          uid,
          activeAssistantProvider,
          chatRepository,
          { appendStreamChunk, clearStream },
          reason,
          isFirstMessage,
          {
            ...recommendationExtras,
            ...(gameContext !== undefined ? { gameContext } : {}),
            ...(setupDepth !== undefined ? { setupDepth } : {}),
            recentMessages,
            priorSuggestions: previouslySuggestedGames(scopedMessages),
            ...(segmentId !== undefined && segmentId.length > 0 ? { segmentId } : {}),
            ...(segmentTitle !== undefined && segmentTitle.length > 0 ? { segmentTitle } : {}),
            ...stamp,
          },
        );

        queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) =>
          mergeMessages(prev ?? [], assistantMessages),
        );

        void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.threads(uid) });
        firebaseAnalytics.track('message_sent', { intent: 'unknown' });

        return assistantMessages;
      } finally {
        sendingRef.current = false;
        turnsInFlight.delete(thread.id);
      }
    },

    onError(error) {
      clearStream();
      const mapped = mapError(error);
      logger.captureException(error, { mapped });
    },
  });
}
