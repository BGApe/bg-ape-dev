import type React from 'react';
import { View } from 'react-native';

import type { ChatMessage } from '../types';

import { CollapseBar } from './CollapseBar';
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
    <View className="mx-4 my-1.5 max-w-[92%] self-start overflow-hidden rounded-2xl">
      <CollapseBar title={title} expanded={expanded} onPress={onToggle} />
      {expanded && (
        <View className="bg-[#141414] py-1">
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
