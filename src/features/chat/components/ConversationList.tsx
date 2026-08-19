import { FlashList } from '@shopify/flash-list';
import type React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';

import { REASON_EMOJI } from '../reasons';
import type { ChatThread } from '../types';

type Props = {
  threads: ChatThread[];
  isLoading: boolean;
  onSelect: (thread: ChatThread) => void;
  onDelete: (thread: ChatThread) => void;
  onNew: () => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ConversationRow({
  thread,
  onSelect,
  onDelete,
}: {
  thread: ChatThread;
  onSelect: (thread: ChatThread) => void;
  onDelete: (thread: ChatThread) => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={() => onSelect(thread)}
      onLongPress={() => onDelete(thread)}
      accessibilityRole="button"
      className="mx-4 mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2 pr-2">
          <Text className="text-base">{REASON_EMOJI[thread.reason]}</Text>
          <Text className="flex-1 text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
            {thread.title || Copy.chat.conversations.untitled}
          </Text>
        </View>
        <Text className="text-xs text-neutral-500">{formatDate(thread.updatedAt)}</Text>
      </View>
      {thread.lastMessagePreview !== undefined && (
        <Text className="mt-1 text-sm text-neutral-400" numberOfLines={1}>
          {thread.lastMessagePreview}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function ConversationList({
  threads,
  isLoading,
  onSelect,
  onDelete,
  onNew,
}: Props): React.JSX.Element {
  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Text className="text-lg font-bold text-[#F9F9F9]">{Copy.chat.conversations.title}</Text>
        <TouchableOpacity
          onPress={onNew}
          accessibilityRole="button"
          className="rounded-full bg-[#6D5DF6] px-3 py-1.5"
        >
          <Text className="text-sm font-semibold text-white">
            {Copy.chat.conversations.newButton}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6D5DF6" />
        </View>
      ) : threads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-neutral-400">
            {Copy.chat.conversations.empty}
          </Text>
        </View>
      ) : (
        <FlashList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow thread={item} onSelect={onSelect} onDelete={onDelete} />
          )}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}
