import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Copy } from '@/constants/copy';
import { QueryKeys } from '@/constants/queryKeys';
import { Routes } from '@/constants/routes';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { chatRepository } from '@/features/chat/api/activeChatRepository';
import { GamePickerFilters } from '@/features/chat/components/intent/GamePickerFilters';
import {
  QuickSetupFilters,
  type IntentGameSelection,
} from '@/features/chat/components/intent/QuickSetupFilters';
import { RulesFilters } from '@/features/chat/components/intent/RulesFilters';
import { useCreateThread } from '@/features/chat/hooks/useCreateThread';
import { useThreads } from '@/features/chat/hooks/useThreads';
import {
  discussionHeading,
  findGameThread,
  newDiscussionId,
  resolveGameAnchor,
} from '@/features/chat/lib/gameThread';
import { newSegmentId } from '@/features/chat/lib/messageGroups';
import { resolveSessionPlayerCount } from '@/features/chat/lib/sessionPlayerCount';
import { applyThreadPatch } from '@/features/chat/lib/threadPatch';
import type {
  ChatMessage,
  ChatReason,
  ChatThread,
  NewChatThread,
  PendingTurn,
} from '@/features/chat/types';
import { useCollection } from '@/features/collection/hooks/useCollection';
import type { RulesFaqItem } from '@/services/bgg/gameProfile';
import { useChatUiStore } from '@/store/chatUiStore';
import type { GameId } from '@/types';

const C = Copy.intent;

/**
 * Intent screen — shown when the user taps one of the "I want to…" actions on Home.
 * The top half shows contextual filters; the bottom shows the constructed prompt
 * (editable) and a "Start conversation" button that creates a thread and auto-sends
 * the first message.
 */
export default function IntentScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const {
    reason: rawReason,
    gameId: rawGameId,
    gameName: rawGameName,
    playerCount: rawPlayerCount,
    topic: rawTopic,
    question: rawQuestion,
    faq: rawFaq,
    continueThreadId: rawContinueThreadId,
    searchPrefill: rawSearchPrefill,
    returnToGame: rawReturnToGame,
  } = useLocalSearchParams<{
    reason: string;
    gameId?: string;
    gameName?: string;
    playerCount?: string;
    topic?: string;
    question?: string;
    faq?: string;
    continueThreadId?: string;
    searchPrefill?: string;
    returnToGame?: string;
  }>();
  const reason: ChatReason =
    rawReason === 'recommendation' || rawReason === 'setup' || rawReason === 'rules'
      ? rawReason
      : 'general';
  const initialGameId =
    typeof rawGameId === 'string' && rawGameId.length > 0 ? (rawGameId as GameId) : undefined;
  const initialGameName =
    typeof rawGameName === 'string' && rawGameName.length > 0 ? rawGameName : undefined;
  const initialPlayerCount =
    typeof rawPlayerCount === 'string' && rawPlayerCount.length > 0 ? rawPlayerCount : undefined;
  const initialTopic = typeof rawTopic === 'string' && rawTopic.length > 0 ? rawTopic : undefined;
  const initialQuestion =
    typeof rawQuestion === 'string' && rawQuestion.length > 0 ? rawQuestion : undefined;
  const startWithFaq = rawFaq === '1';
  const continueThreadId =
    typeof rawContinueThreadId === 'string' && rawContinueThreadId.length > 0
      ? rawContinueThreadId
      : undefined;
  const searchPrefill =
    typeof rawSearchPrefill === 'string' && rawSearchPrefill.length > 0
      ? rawSearchPrefill
      : undefined;
  const returnToGame = rawReturnToGame === '1';
  const formGameName =
    initialGameName ?? (continueThreadId !== undefined ? searchPrefill : undefined);

  const { data: games = [] } = useCollection();
  const { data: threads = [] } = useThreads();
  const createThread = useCreateThread();
  const setActiveThreadId = useChatUiStore((s) => s.setActiveThreadId);
  const setPendingMessage = useChatUiStore((s) => s.setPendingMessage);
  const setPendingTurn = useChatUiStore((s) => s.setPendingTurn);
  const setDiscussionFilter = useChatUiStore((s) => s.setDiscussionFilter);

  const [builtPrompt, setBuiltPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [promptTouched, setPromptTouched] = useState(false);
  const [gameSelection, setGameSelection] = useState<IntentGameSelection>({});
  const [sessionPlayerCount, setSessionPlayerCount] = useState<string | undefined>();

  /** When filters change, update the prompt textarea (unless user has manually edited it). */
  function handlePromptChange(p: string) {
    setBuiltPrompt(p);
    if (!promptTouched) setEditedPrompt(p);
  }

  const activePrompt = promptTouched ? editedPrompt : builtPrompt;

  // Reuse player count from a recent recommendation for the same game (≤2h).
  useEffect(() => {
    if (reason !== 'setup' || initialPlayerCount !== undefined) {
      setSessionPlayerCount(undefined);
      return;
    }
    const gameName = gameSelection.gameName;
    if (!gameName || !user) {
      setSessionPlayerCount(undefined);
      return;
    }

    let cancelled = false;
    void resolveSessionPlayerCount({
      threads,
      gameName,
      loadMessages: async (thread) => {
        const key = QueryKeys.chat.messages(thread.id);
        const cached = queryClient.getQueryData<ChatMessage[]>(key);
        if (cached) return cached;
        const msgs = await chatRepository.getMessages(user.uid, thread.id);
        queryClient.setQueryData(key, msgs);
        return msgs;
      },
    }).then((count) => {
      if (!cancelled) setSessionPlayerCount(count);
    });

    return () => {
      cancelled = true;
    };
  }, [reason, initialPlayerCount, gameSelection.gameName, threads, user, queryClient]);

  const titleMap: Record<ChatReason, string> = {
    recommendation: C.gamePicker.title,
    setup: C.quickSetup.title,
    rules: C.rulesHelper.title,
    general: Copy.chat.reasons.general,
  };

  const setupNeedsPlayers = reason === 'setup' && !gameSelection.playerCount;
  const canStart = Boolean(activePrompt.trim()) && !createThread.isPending && !setupNeedsPlayers;

  function rememberThread(thread: ChatThread) {
    if (!user) return;
    queryClient.setQueryData<ChatThread[]>(QueryKeys.chat.threads(user.uid), (prev) => {
      const list = prev ?? [];
      if (list.some((item) => item.id === thread.id)) {
        return list.map((item) => (item.id === thread.id ? thread : item));
      }
      return [thread, ...list];
    });
  }

  async function ensureGameThread(): Promise<ChatThread | null> {
    if (!user || (reason !== 'setup' && reason !== 'rules')) return null;
    const versionName = gameSelection.gameName;
    if (versionName === undefined || versionName.length === 0) return null;

    if (continueThreadId !== undefined) {
      return threads.find((thread) => thread.id === continueThreadId) ?? null;
    }

    const anchor = resolveGameAnchor(
      {
        ...(gameSelection.gameId !== undefined ? { gameId: gameSelection.gameId } : {}),
        gameName: versionName,
      },
      games,
    );
    if (anchor === null) return null;

    const found = findGameThread(threads, anchor, games);
    if (found !== undefined) {
      const patch = {
        gameKey: anchor.key,
        title: anchor.gameName,
        gameName: anchor.gameName,
        ...(anchor.gameId !== undefined ? { gameId: anchor.gameId } : {}),
      };
      if (found.gameKey !== anchor.key || found.title !== anchor.gameName) {
        await chatRepository.updateThread(user.uid, found.id, patch);
      }
      const next = applyThreadPatch(found, patch);
      rememberThread(next);
      return next;
    }

    const input: NewChatThread = {
      title: anchor.gameName,
      reason: 'general',
      gameKey: anchor.key,
      gameName: anchor.gameName,
    };
    if (anchor.gameId !== undefined) input.gameId = anchor.gameId;
    const created = await createThread.mutateAsync(input);
    rememberThread(created);
    return created;
  }

  function queueDiscussion(thread: ChatThread, text: string, kind: 'setup' | 'rules') {
    const versionName = gameSelection.gameName ?? thread.gameName ?? 'Game';
    const playerCount = kind === 'setup' ? gameSelection.playerCount : undefined;
    const turn: PendingTurn = {
      text,
      discussionId: newDiscussionId(),
      discussionTitle: discussionHeading(versionName, kind, playerCount),
      discussionKind: kind,
      versionName,
    };
    if (playerCount !== undefined && playerCount.length > 0) turn.playerCount = playerCount;
    setPendingTurn(turn);
    setDiscussionFilter(kind);
    openThread(thread.id);
  }

  function openThread(threadId: string) {
    setActiveThreadId(threadId);
    if (continueThreadId !== undefined) {
      router.back();
      return;
    }
    if (returnToGame) {
      router.replace(Routes.gameChat);
      return;
    }
    router.replace('/(app)/(tabs)/chat');
  }

  function handleStart() {
    const msg = activePrompt.trim();
    if (!msg || createThread.isPending || setupNeedsPlayers) return;

    if (reason === 'setup' || reason === 'rules') {
      void ensureGameThread().then((thread) => {
        if (thread === null) return;
        queueDiscussion(thread, msg, reason);
      });
      return;
    }

    const input: NewChatThread = { title: titleMap[reason], reason };
    if (gameSelection.gameId !== undefined) input.gameId = gameSelection.gameId;
    if (gameSelection.gameName !== undefined && gameSelection.gameName.length > 0) {
      input.gameName = gameSelection.gameName;
    }

    createThread.mutate(input, {
      onSuccess: (thread) => {
        setPendingMessage(msg);
        setActiveThreadId(thread.id);
        router.replace('/(app)/(tabs)/chat');
      },
    });
  }

  async function handleSelectFaq(item: RulesFaqItem) {
    if (!user || createThread.isPending) return;
    const thread = await ensureGameThread();
    if (thread === null) return;
    const versionName = gameSelection.gameName ?? thread.gameName ?? 'Game';
    const discussionId = newDiscussionId();
    const segmentId = newSegmentId();
    const segmentTitle = item.question.trim().slice(0, 80) || 'Rules question';
    const discussionTitle = discussionHeading(versionName, 'rules');
    const now = Date.now();
    const userMessage = await chatRepository.addMessage(user.uid, thread.id, {
      threadId: thread.id,
      role: 'user',
      content: item.question,
      createdAt: now,
      label: segmentTitle,
      segmentId,
      segmentTitle,
      discussionId,
      discussionTitle,
      discussionKind: 'rules',
      versionName,
    });
    const assistantMessage = await chatRepository.addMessage(user.uid, thread.id, {
      threadId: thread.id,
      role: 'assistant',
      content: `${item.question}\n\n${item.answer}`,
      createdAt: now + 1,
      segmentId,
      segmentTitle,
      discussionId,
      discussionTitle,
      discussionKind: 'rules',
      versionName,
    });
    queryClient.setQueryData(
      QueryKeys.chat.messages(thread.id),
      (prev: ChatMessage[] | undefined) => [...(prev ?? []), userMessage, assistantMessage],
    );
    setDiscussionFilter('rules');
    openThread(thread.id);
  }

  const filterPanel =
    reason === 'recommendation' ? (
      <GamePickerFilters games={games} onPromptChange={handlePromptChange} />
    ) : reason === 'setup' ? (
      <QuickSetupFilters
        games={games}
        onPromptChange={handlePromptChange}
        onContextChange={setGameSelection}
        {...(continueThreadId === undefined && initialGameId !== undefined
          ? { initialGameId }
          : {})}
        {...(formGameName !== undefined ? { initialGameName: formGameName } : {})}
        {...(initialPlayerCount !== undefined ? { initialPlayerCount } : {})}
        {...(sessionPlayerCount !== undefined ? { sessionPlayerCount } : {})}
      />
    ) : reason === 'rules' ? (
      <RulesFilters
        games={games}
        onPromptChange={handlePromptChange}
        onContextChange={setGameSelection}
        onSelectFaq={(item) => {
          void handleSelectFaq(item);
        }}
        startWithFaq={startWithFaq}
        {...(continueThreadId === undefined && initialGameId !== undefined
          ? { initialGameId }
          : {})}
        {...(formGameName !== undefined ? { initialGameName: formGameName } : {})}
        {...(initialTopic !== undefined ? { initialTopic } : {})}
        {...(initialQuestion !== undefined ? { initialQuestion } : {})}
      />
    ) : null;

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: '#0F0F0F',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-[#2A2A2A] px-3 pb-2 pt-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text className="text-lg text-neutral-300">{C.backButton}</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-[#F9F9F9]">{titleMap[reason]}</Text>
      </View>

      {/* For 'general' reason, skip directly to prompt + send */}
      {filterPanel !== null ? (
        <View style={{ flex: 1 }}>{filterPanel}</View>
      ) : (
        <View className="flex-1" />
      )}

      {/* Prompt preview + Start button */}
      <View className="border-t border-[#2A2A2A] px-4 pt-3 pb-2">
        <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
          {C.promptPreviewLabel}
        </Text>
        <TextInput
          className="mb-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
          placeholder={C.promptPlaceholder}
          placeholderTextColor="#525252"
          value={activePrompt}
          onChangeText={(v) => {
            setPromptTouched(true);
            setEditedPrompt(v);
          }}
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />

        <TouchableOpacity
          onPress={handleStart}
          disabled={!canStart}
          accessibilityRole="button"
          className={`rounded-2xl py-3.5 ${canStart ? 'bg-[#818CF8]' : 'bg-[#818CF8]/30'}`}
        >
          <Text className="text-center text-sm font-semibold text-white">
            {createThread.isPending ? 'Starting…' : C.startButton}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
