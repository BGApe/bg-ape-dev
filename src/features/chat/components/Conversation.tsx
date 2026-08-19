import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Copy } from '@/constants/copy';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { mapError } from '@/lib/mapError';
import { useChatUiStore } from '@/store/chatUiStore';
import { useComposerStore } from '@/store/composerStore';

import { useChatMessages } from '../hooks/useChatMessages';
import { useClearConversation } from '../hooks/useClearConversation';
import { useDeleteMessage } from '../hooks/useDeleteMessage';
import { useSendMessage } from '../hooks/useSendMessage';
import { REASON_EMOJI } from '../reasons';
import type { ChatMessage, ChatThread } from '../types';

import { Composer } from './Composer';
import { GameContextCard } from './GameContextCard';
import { MessageBubble } from './MessageBubble';

type Props = {
  thread: ChatThread;
  onBack: () => void;
};

export function Conversation({ thread, onBack }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { data: messages = [] } = useChatMessages(thread);
  const sendMessage = useSendMessage(thread);
  const clearConversation = useClearConversation(thread);
  const deleteMessage = useDeleteMessage(thread);
  const draft = useComposerStore((s) => s.draft);
  const setDraft = useComposerStore((s) => s.setDraft);
  const streamingContent = useComposerStore((s) => s.streamingContent);
  const pendingMessage = useChatUiStore((s) => s.pendingMessage);
  const setPendingMessage = useChatUiStore((s) => s.setPendingMessage);
  const { data: collectionGames = [] } = useCollection();
  const contextGame =
    thread.gameId !== undefined
      ? collectionGames.find((g) => g.id === thread.gameId)
      : thread.gameName !== undefined
        ? collectionGames.find((g) => g.name.toLowerCase() === thread.gameName?.toLowerCase())
        : undefined;

  /** Auto-send any message queued by the intent screen. */
  useEffect(() => {
    if (!pendingMessage) return;
    const msg = pendingMessage;
    setPendingMessage(null);
    sendMessage.mutate(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  const isSending = sendMessage.isPending;
  const error = sendMessage.error ? mapError(sendMessage.error) : null;

  const allMessages: ChatMessage[] = streamingContent
    ? [
        ...messages,
        {
          id: 'streaming' as ChatMessage['id'],
          threadId: thread.id as ChatMessage['threadId'],
          role: 'assistant',
          content: streamingContent,
          createdAt: Date.now(),
        },
      ]
    : messages;

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setDraft('');
    sendMessage.mutate(trimmed);
  }

  function handleSend() {
    sendText(draft);
  }

  function handleClear() {
    Alert.alert(Copy.chat.clearConfirmTitle, Copy.chat.clearConfirmBody, [
      { text: Copy.chat.cancel, style: 'cancel' },
      {
        text: Copy.chat.clearConversation,
        style: 'destructive',
        onPress: () => clearConversation.mutate(),
      },
    ]);
  }

  function handleDeleteMessage(message: ChatMessage) {
    if (message.id === 'streaming') return;
    Alert.alert(Copy.chat.deleteMessageTitle, Copy.chat.deleteMessageBody, [
      { text: Copy.chat.cancel, style: 'cancel' },
      {
        text: Copy.chat.delete,
        style: 'destructive',
        onPress: () => deleteMessage.mutate(message.id),
      },
    ]);
  }

  const errorBanner =
    error !== null ? (
      <View className="mx-4 mb-2 rounded-xl bg-red-500/20 px-4 py-3">
        <Text className="text-sm text-red-400">{error.message}</Text>
        <Text className="mt-1 text-xs text-red-300 underline" onPress={() => sendMessage.reset()}>
          {Copy.chat.errorRetry}
        </Text>
      </View>
    ) : null;

  const composer = (
    <Composer value={draft} onChangeText={setDraft} onSend={handleSend} isSending={isSending} />
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-row items-center gap-2 border-b border-[#2A2A2A] px-3 pb-2 pt-1">
        <TouchableOpacity
          onPress={onBack}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel={Copy.tabs.chat}
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
            {REASON_EMOJI[thread.reason]} {thread.title}
          </Text>
          {thread.gameName !== undefined && (
            <Text className="text-xs text-neutral-500" numberOfLines={1}>
              {thread.gameName}
            </Text>
          )}
        </View>
        {allMessages.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            className="px-2 py-1"
            accessibilityRole="button"
            accessibilityLabel={Copy.chat.clearConversation}
          >
            <Text className="text-sm text-neutral-400">{Copy.chat.clearConversation}</Text>
          </TouchableOpacity>
        )}
      </View>

      {allMessages.length === 0 ? (
        <View className="flex-1 justify-center px-2">
          <Text className="mb-6 px-6 text-center text-base text-neutral-400">
            {Copy.chat.emptyState}
          </Text>
          <View className="mb-6 gap-2 px-4">
            {Copy.chat.starters.map((starter) => (
              <TouchableOpacity
                key={starter}
                onPress={() => sendText(starter)}
                disabled={isSending}
                className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
                accessibilityRole="button"
              >
                <Text className="text-sm text-[#F9F9F9]">{starter}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errorBanner}
          {composer}
        </View>
      ) : (
        <View className="flex-1">
          <FlashList
            data={allMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} onLongPress={handleDeleteMessage} />
            )}
            ListHeaderComponent={
              thread.gameName !== undefined ? (
                <GameContextCard gameName={thread.gameName} game={contextGame} />
              ) : null
            }
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          />
          {errorBanner}
          {composer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
