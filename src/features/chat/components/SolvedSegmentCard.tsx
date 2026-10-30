import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';

import type { ChatMessage } from '../types';

import { MessageBubble } from './MessageBubble';

type Props = {
  title: string;
  messages: ChatMessage[];
  expanded: boolean;
  onToggle: () => void;
  onLongPress?: (message: ChatMessage) => void;
};

export function SolvedSegmentCard({
  title,
  messages,
  expanded,
  onToggle,
  onLongPress,
}: Props): React.JSX.Element {
  return (
    <View className="mx-4 my-1 max-w-[90%] self-start overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#141414]">
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <Text className="flex-1 text-sm font-semibold text-[#F9F9F9]" numberOfLines={2}>
          {title}
        </Text>
        <Text className="ml-3 text-xs text-[#C7D2FE]">
          {expanded ? Copy.chat.reply.solvedCollapse : Copy.chat.reply.solvedExpand}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View className="border-t border-[#2A2A2A] py-1">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              {...(onLongPress !== undefined ? { onLongPress } : {})}
            />
          ))}
        </View>
      )}
    </View>
  );
}
