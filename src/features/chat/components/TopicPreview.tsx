import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  preview: string;
  expanded: boolean;
  onPress: () => void;
  /** Shifts a follow-up under the card it belongs to. */
  indent?: boolean;
  children?: React.ReactNode;
};

/** Headline plus a short excerpt. A tap opens the full text. */
export function TopicPreview({
  title,
  preview,
  expanded,
  onPress,
  indent = false,
  children,
}: Props): React.JSX.Element {
  return (
    <View
      className={`my-1 max-w-[92%] self-start rounded-2xl border border-white/15 bg-white/5 px-4 py-3 ${
        indent ? 'ml-8 mr-4' : 'mx-4'
      }`}
    >
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View className="flex-row items-start">
          <Text className="flex-1 pr-3 text-base font-semibold text-[#F4F6FB]">{title}</Text>
          <Text className="text-lg text-[#D6DEEE]">{expanded ? '▴' : '▾'}</Text>
        </View>
        {!expanded && preview.length > 0 && (
          <Text className="mt-1 text-sm leading-relaxed text-neutral-300" numberOfLines={4}>
            {preview}
          </Text>
        )}
      </TouchableOpacity>
      {expanded ? children : null}
    </View>
  );
}
