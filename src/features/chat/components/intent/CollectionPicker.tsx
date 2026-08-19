import type React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

import type { CollectionGame } from '@/features/collection/types';

type Props = {
  games: CollectionGame[];
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
};

/**
 * Compact scrollable list of collection games that fits inside filter panels
 * without overflowing on large collections.
 */
export function CollectionPicker({ games, selectedId, onSelect }: Props): React.JSX.Element {
  if (games.length === 0) {
    return (
      <Text className="text-sm text-neutral-500">Your collection is empty. Add games first.</Text>
    );
  }

  return (
    <ScrollView
      style={{ maxHeight: 168 }}
      className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A]"
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      {games.map((g, i) => {
        const sel = selectedId === g.id;
        return (
          <TouchableOpacity
            key={g.id}
            onPress={() => onSelect(sel ? undefined : g.id)}
            accessibilityRole="radio"
            className={`flex-row items-center justify-between px-4 py-3 ${
              i < games.length - 1 ? 'border-b border-[#2A2A2A]' : ''
            } ${sel ? 'bg-[#818CF8]/10' : ''}`}
          >
            <Text
              className={`flex-1 text-sm ${sel ? 'font-semibold text-[#818CF8]' : 'text-neutral-300'}`}
              numberOfLines={1}
            >
              {g.name}
            </Text>
            {sel && <Text className="ml-2 text-sm text-[#818CF8]">✓</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
