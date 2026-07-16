import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Copy } from '@/constants/copy';
import { Composer } from '@/features/chat/components/Composer';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useChatThread } from '@/features/chat/hooks/useChatThread';
import { useSendMessage } from '@/features/chat/hooks/useSendMessage';
import type { ChatMessage } from '@/features/chat/types';
import { mapError } from '@/lib/mapError';
import { useComposerStore } from '@/store/composerStore';

export default function ChatScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { thread } = useChatThread();
  const { data: messages = [] } = useChatMessages(thread);
  const sendMessage = useSendMessage();
  const draft = useComposerStore((s) => s.draft);
  const setDraft = useComposerStore((s) => s.setDraft);
  const streamingContent = useComposerStore((s) => s.streamingContent);

  const isSending = sendMessage.isPending;
  const error = sendMessage.error ? mapError(sendMessage.error) : null;

  const allMessages: ChatMessage[] = streamingContent
    ? [
        ...messages,
        {
          id: 'streaming' as ChatMessage['id'],
          threadId: (thread?.id ?? 'none') as ChatMessage['threadId'],
          role: 'assistant',
          content: streamingContent,
          createdAt: Date.now(),
        },
      ]
    : messages;

  function handleSend() {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    sendMessage.mutate(text);
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
      style={{
        flex: 1,
        backgroundColor: '#0F0F0F',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {allMessages.length === 0 ? (
        // Empty state: prompt + composer centered in the middle of the screen.
        <View className="flex-1 justify-center px-2">
          <Text className="mb-6 px-6 text-center text-base text-neutral-400">
            {Copy.chat.emptyState}
          </Text>
          {errorBanner}
          {composer}
        </View>
      ) : (
        <View className="flex-1">
          <FlashList
            data={allMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
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
