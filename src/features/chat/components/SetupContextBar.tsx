import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { SetupDepth } from '@/features/assistant/types';

const DEPTH_LABEL: Record<SetupDepth, string> = {
  quick: '5 minutes',
  basic: 'Core rules',
  full: 'Full walkthrough',
};

type Props = {
  gameName: string;
  playerCount?: string;
  depth?: SetupDepth;
  expanded: boolean;
  onPress: () => void;
};

/** Collapsed quick-setup bar: the game and the depth that was chosen. */
export function SetupContextBar({
  gameName,
  playerCount,
  depth,
  expanded,
  onPress,
}: Props): React.JSX.Element {
  const spoken = [
    gameName,
    playerCount !== undefined ? `${playerCount} players` : '',
    depth !== undefined ? DEPTH_LABEL[depth] : '',
  ]
    .filter((part) => part.length > 0)
    .join(', ');

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={spoken}
      className="flex-row items-center bg-[#2C3548] px-4 py-3"
    >
      <View className="flex-1 flex-row flex-wrap items-center pr-3">
        <Chip icon="🎲" value={gameName} />
        {playerCount !== undefined && playerCount.length > 0 && (
          <Chip icon="👤" value={playerCount} />
        )}
        {depth !== undefined && <Chip icon="📖" value={DEPTH_LABEL[depth]} />}
      </View>
      <Text className="text-2xl text-[#D6DEEE]">{expanded ? '▴' : '▾'}</Text>
    </TouchableOpacity>
  );
}

function Chip({ icon, value }: { icon: string; value: string }): React.JSX.Element {
  return (
    <View className="mr-3 mb-1 flex-row items-center">
      <Text className="text-sm">{icon}</Text>
      <Text className="ml-1 text-sm font-semibold text-[#F4F6FB]">{value}</Text>
    </View>
  );
}
