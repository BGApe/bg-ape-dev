import { useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
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
import { GamePickerFilters } from '@/features/chat/components/intent/GamePickerFilters';
import { QuickSetupFilters } from '@/features/chat/components/intent/QuickSetupFilters';
import { RulesFilters } from '@/features/chat/components/intent/RulesFilters';
import { useCreateThread } from '@/features/chat/hooks/useCreateThread';
import type { ChatReason } from '@/features/chat/types';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { useChatUiStore } from '@/store/chatUiStore';

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
  const { reason: rawReason } = useLocalSearchParams<{ reason: string }>();
  const reason: ChatReason =
    rawReason === 'recommendation' || rawReason === 'setup' || rawReason === 'rules'
      ? rawReason
      : 'general';

  const { data: games = [] } = useCollection();
  const createThread = useCreateThread();
  const setActiveThreadId = useChatUiStore((s) => s.setActiveThreadId);
  const setPendingMessage = useChatUiStore((s) => s.setPendingMessage);

  const [builtPrompt, setBuiltPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [promptTouched, setPromptTouched] = useState(false);

  /** When filters change, update the prompt textarea (unless user has manually edited it). */
  function handlePromptChange(p: string) {
    setBuiltPrompt(p);
    if (!promptTouched) setEditedPrompt(p);
  }

  const activePrompt = promptTouched ? editedPrompt : builtPrompt;

  const titleMap: Record<ChatReason, string> = {
    recommendation: C.gamePicker.title,
    setup: C.quickSetup.title,
    rules: C.rulesHelper.title,
    general: Copy.chat.reasons.general,
  };

  function handleStart() {
    const msg = activePrompt.trim();
    if (!msg || createThread.isPending) return;

    createThread.mutate(
      { title: titleMap[reason], reason },
      {
        onSuccess: (thread) => {
          setPendingMessage(msg);
          setActiveThreadId(thread.id);
          router.replace('/(app)/chat');
        },
      },
    );
  }

  const filterPanel =
    reason === 'recommendation' ? (
      <GamePickerFilters onPromptChange={handlePromptChange} />
    ) : reason === 'setup' ? (
      <QuickSetupFilters games={games} onPromptChange={handlePromptChange} />
    ) : reason === 'rules' ? (
      <RulesFilters games={games} onPromptChange={handlePromptChange} />
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
          disabled={!activePrompt.trim() || createThread.isPending}
          accessibilityRole="button"
          className={`rounded-2xl py-3.5 ${
            activePrompt.trim() && !createThread.isPending ? 'bg-[#818CF8]' : 'bg-[#818CF8]/30'
          }`}
        >
          <Text className="text-center text-sm font-semibold text-white">
            {createThread.isPending ? 'Starting…' : C.startButton}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
