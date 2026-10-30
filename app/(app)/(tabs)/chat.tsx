import { useFocusEffect } from 'expo-router';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { Copy } from '@/constants/copy';
import { Conversation } from '@/features/chat/components/Conversation';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { NewConversationSheet } from '@/features/chat/components/NewConversationSheet';
import { useCreateThread } from '@/features/chat/hooks/useCreateThread';
import { useDeleteThread } from '@/features/chat/hooks/useDeleteThread';
import { useThreads } from '@/features/chat/hooks/useThreads';
import type { ChatThread, NewChatThread } from '@/features/chat/types';
import { useChatUiStore } from '@/store/chatUiStore';

export default function ChatScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { data: threads = [], isLoading } = useThreads();
  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();

  const activeThreadId = useChatUiStore((s) => s.activeThreadId);
  const setActiveThreadId = useChatUiStore((s) => s.setActiveThreadId);
  const setDiscussionFilter = useChatUiStore((s) => s.setDiscussionFilter);
  const setVersionSeed = useChatUiStore((s) => s.setVersionSeed);
  const [isCreating, setIsCreating] = useState(false);

  const activeThread: ChatThread | null = threads.find((t) => t.id === activeThreadId) ?? null;

  // Android hardware back: leave this conversation for the list, only while the tab is showing.
  useFocusEffect(
    useCallback(() => {
      if (activeThread === null) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setActiveThreadId(null);
        return true;
      });
      return () => sub.remove();
    }, [activeThread, setActiveThreadId]),
  );

  function handleCreate(input: NewChatThread) {
    setIsCreating(false);
    createThread.mutate(input, {
      onSuccess: (thread) => setActiveThreadId(thread.id),
    });
  }

  function handleDelete(thread: ChatThread) {
    Alert.alert(Copy.chat.conversations.deleteTitle, Copy.chat.conversations.deleteBody, [
      { text: Copy.chat.cancel, style: 'cancel' },
      {
        text: Copy.chat.delete,
        style: 'destructive',
        onPress: () => {
          if (activeThreadId === thread.id) setActiveThreadId(null);
          deleteThread.mutate(thread.id);
        },
      },
    ]);
  }

  if (activeThread !== null) {
    return <Conversation thread={activeThread} onBack={() => setActiveThreadId(null)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}>
      <AskBar />
      <ConversationList
        threads={threads}
        isLoading={isLoading}
        onSelect={(t) => {
          setDiscussionFilter(null);
          setVersionSeed(null);
          setActiveThreadId(t.id);
        }}
        onDelete={handleDelete}
        onNew={() => setIsCreating(true)}
      />
      <NewConversationSheet
        visible={isCreating}
        onClose={() => setIsCreating(false)}
        onCreate={handleCreate}
      />
    </View>
  );
}
