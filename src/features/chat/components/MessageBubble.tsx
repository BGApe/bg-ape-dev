import type React from 'react';
import { Pressable, Text } from 'react-native';

import type { ChatMessage } from '../types';

type Props = {
  message: ChatMessage;
  onLongPress?: (message: ChatMessage) => void;
};

export function MessageBubble({ message, onLongPress }: Props): React.JSX.Element {
  const isUser = message.role === 'user';
  const deletable = onLongPress !== undefined && message.isOptimistic !== true;

  return (
    <Pressable
      onLongPress={deletable ? () => onLongPress(message) : undefined}
      delayLongPress={350}
      className={`mx-4 my-1 max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser ? 'self-end bg-indigo-600' : 'self-start bg-[#1A1A1A]'
      } ${message.isOptimistic === true ? 'opacity-70' : 'opacity-100'}`}
    >
      <Text className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-[#F9F9F9]'}`}>
        {message.content}
      </Text>
    </Pressable>
  );
}
