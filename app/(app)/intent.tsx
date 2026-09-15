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
import { resolveSessionPlayerCount } from '@/features/chat/lib/sessionPlayerCount';
import type { ChatMessage, ChatReason, NewChatThread } from '@/features/chat/types';
import { useCollection } from '@/features/collection/hooks/useCollection';
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
  const { reason: rawReason, gameId: rawGameId } = useLocalSearchParams<{
    reason: string;
    gameId?: string;
  }>();
  const reason: ChatReason =
    rawReason === 'recommendation' || rawReason === 'setup' || rawReason === 'rules'
      ? rawReason
      : 'general';
  const initialGameId =
    typeof rawGameId === 'string' && rawGameId.length > 0 ? (rawGameId as GameId) : undefined;

  const { data: games = [] } = useCollection();
  const { data: threads = [] } = useThreads();
  const createThread = useCreateThread();
  const setActiveThreadId = useChatUiStore((s) => s.setActiveThreadId);
  const setPendingMessage = useChatUiStore((s) => s.setPendingMessage);

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
    if (reason !== 'setup') {
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
  }, [reason, gameSelection.gameName, threads, user, queryClient]);

  const titleMap: Record<ChatReason, string> = {
    recommendation: C.gamePicker.title,
    setup: C.quickSetup.title,
    rules: C.rulesHelper.title,
    general: Copy.chat.reasons.general,
  };

  const setupNeedsPlayers = reason === 'setup' && !gameSelection.playerCount;
  const canStart = Boolean(activePrompt.trim()) && !createThread.isPending && !setupNeedsPlayers;

  function handleStart() {
    const msg = activePrompt.trim();
    if (!msg || createThread.isPending || setupNeedsPlayers) return;

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

  const filterPanel =
    reason === 'recommendation' ? (
      <GamePickerFilters games={games} onPromptChange={handlePromptChange} />
    ) : reason === 'setup' ? (
      <QuickSetupFilters
        games={games}
        onPromptChange={handlePromptChange}
        onContextChange={setGameSelection}
        {...(initialGameId !== undefined ? { initialGameId } : {})}
        {...(sessionPlayerCount !== undefined ? { sessionPlayerCount } : {})}
      />
    ) : reason === 'rules' ? (
      <RulesFilters
        games={games}
        onPromptChange={handlePromptChange}
        onContextChange={setGameSelection}
        {...(initialGameId !== undefined ? { initialGameId } : {})}
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
