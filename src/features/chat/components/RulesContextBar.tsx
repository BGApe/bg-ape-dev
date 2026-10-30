import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';

import type { VersionChoice } from '../lib/gameThread';

type Props = {
  playerChips: readonly string[];
  playerCount: string | undefined;
  versions: readonly VersionChoice[];
  versionName: string;
  onPlayerCount: (count: string) => void;
  onVersion: (name: string) => void;
};

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`mr-2 mb-2 rounded-full border px-3 py-1.5 ${
        selected ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      <Text className={`text-sm ${selected ? 'text-[#C7D2FE]' : 'text-[#F9F9F9]'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Player count and version confirmed before a rules question. */
export function RulesContextBar({
  playerChips,
  playerCount,
  versions,
  versionName,
  onPlayerCount,
  onVersion,
}: Props): React.JSX.Element {
  return (
    <View className="mx-4 mb-2">
      <Text className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
        {Copy.intent.quickSetup.playersLabel}
      </Text>
      <View className="flex-row flex-wrap">
        {playerChips.map((count) => (
          <Chip
            key={count}
            label={count}
            selected={count === playerCount}
            onPress={() => onPlayerCount(count)}
          />
        ))}
      </View>
      <Text className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
        {Copy.chat.reply.versionLabel}
      </Text>
      <View className="flex-row flex-wrap">
        {versions.map((version) => (
          <Chip
            key={version.name}
            label={version.name}
            selected={version.name.toLowerCase() === versionName.trim().toLowerCase()}
            onPress={() => onVersion(version.name)}
          />
        ))}
      </View>
    </View>
  );
}
