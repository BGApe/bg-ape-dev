import type React from 'react';
import { Text, TouchableOpacity } from 'react-native';

type Props = {
  title: string;
  expanded: boolean;
  onPress: () => void;
};

/** Tappable heading for a collapsed chat section. */
export function CollapseBar({ title, expanded, onPress }: Props): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      className="flex-row items-center bg-[#2C3548] px-4 py-4"
    >
      <Text className="flex-1 pr-3 text-base font-semibold text-[#F4F6FB]" numberOfLines={3}>
        {title}
      </Text>
      <Text className="text-2xl text-[#D6DEEE]">{expanded ? '▴' : '▾'}</Text>
    </TouchableOpacity>
  );
}
