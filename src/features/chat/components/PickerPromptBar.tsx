import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';

import { parsePickerPrompt } from '../lib/pickerSummary';

type Props = {
  title: string;
  expanded: boolean;
  onPress: () => void;
};

/** Game-picker request shown as filter icons. Other requests stay as a title. */
export function PickerPromptBar({ title, expanded, onPress }: Props): React.JSX.Element {
  const summary = parsePickerPrompt(title);
  const spoken =
    summary === null
      ? title
      : summary.chips.map((chip) => chip.spoken).join(', ') || Copy.intent.gamePicker.title;

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={spoken}
      className="flex-row items-center bg-[#2C3548] px-4 py-3"
    >
      <View className="flex-1 pr-3">
        {summary === null ? (
          <Text className="text-base font-semibold text-[#F4F6FB]" numberOfLines={3}>
            {title}
          </Text>
        ) : summary.chips.length === 0 && summary.note === undefined ? (
          <Text className="text-base font-semibold text-[#F4F6FB]">
            {Copy.intent.gamePicker.title}
          </Text>
        ) : (
          <>
            <View className="flex-row flex-wrap items-center">
              {summary.chips.map((chip) => (
                <View key={chip.id} className="mr-3 mb-1 flex-row items-center">
                  <Text className="text-sm">{chip.icon}</Text>
                  <Text
                    style={chip.color !== undefined ? { color: chip.color } : undefined}
                    className="ml-1 text-sm font-semibold text-[#F4F6FB]"
                  >
                    {chip.value}
                  </Text>
                </View>
              ))}
            </View>
            {summary.note !== undefined && (
              <Text className="text-xs text-[#D6DEEE]" numberOfLines={1}>
                {summary.note}
              </Text>
            )}
          </>
        )}
      </View>
      <Text className="text-2xl text-[#D6DEEE]">{expanded ? '▴' : '▾'}</Text>
    </TouchableOpacity>
  );
}
