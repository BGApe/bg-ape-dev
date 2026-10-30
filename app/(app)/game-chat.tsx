import { useNavigation, useRouter } from 'expo-router';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Conversation } from '@/features/chat/components/Conversation';
import { useThreads } from '@/features/chat/hooks/useThreads';
import type { ChatThread } from '@/features/chat/types';
import { useChatUiStore } from '@/store/chatUiStore';

/**
 * Game chat pushed on top of game detail, so the phone back button returns there.
 */
export default function GameChatScreen(): React.JSX.Element {
  const router = useRouter();
  const navigation = useNavigation();
  const { data: threads = [], isLoading } = useThreads();
  const activeThreadId = useChatUiStore((s) => s.activeThreadId);
  const setActiveThreadId = useChatUiStore((s) => s.setActiveThreadId);
  const setDiscussionFilter = useChatUiStore((s) => s.setDiscussionFilter);
  const setVersionSeed = useChatUiStore((s) => s.setVersionSeed);
  const thread = threads.find((item) => item.id === activeThreadId) ?? null;
  const held = useRef<ChatThread | null>(null);
  if (thread !== null) held.current = thread;
  const shown = thread ?? held.current;

  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      setActiveThreadId(null);
      setDiscussionFilter(null);
      setVersionSeed(null);
    });
  }, [navigation, setActiveThreadId, setDiscussionFilter, setVersionSeed]);

  useEffect(() => {
    if (!isLoading && activeThreadId === null && held.current === null) router.back();
  }, [activeThreadId, isLoading, router]);

  if (shown === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F0F' }} className="items-center justify-center">
        <ActivityIndicator color="#818CF8" />
      </View>
    );
  }

  return <Conversation thread={shown} onBack={() => router.back()} />;
}
