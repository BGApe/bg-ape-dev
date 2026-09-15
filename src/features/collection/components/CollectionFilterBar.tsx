import type React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { BGG_CATEGORY_OPTIONS, BGG_MECHANIC_OPTIONS } from '@/features/chat/lib/bggTagOptions';

import type { CollectionFilters, CollectionSort } from '../lib/collectionFilters';

type OpenPanel = 'players' | 'complexity' | 'playTime' | 'tags' | null;

type Props = {
  filters: CollectionFilters;
  sort: CollectionSort;
  openPanel: OpenPanel;
  onChangeFilters: (patch: Partial<CollectionFilters>) => void;
  onChangeSort: (sort: CollectionSort) => void;
  onChangePanel: (panel: OpenPanel) => void;
};

const PLAYER_OPTS = ['1', '2', '3', '4', '5', '6+'] as const;
const COMPLEXITY_OPTS = Copy.intent.gamePicker.complexityOptions;
const PLAY_TIME_OPTS = Copy.intent.gamePicker.playTimeOptions;
const TAG_OPTS: readonly string[] = [...BGG_CATEGORY_OPTIONS, ...BGG_MECHANIC_OPTIONS];

const SORT_OPTS: { id: CollectionSort; label: string }[] = [
  { id: 'name', label: Copy.collection.sortName },
  { id: 'mostPlayed', label: Copy.collection.sortMostPlayed },
  { id: 'leastPlayed', label: Copy.collection.sortLeastPlayed },
  { id: 'lastPlayed', label: Copy.collection.sortLastPlayed },
];

function FilterIcon({
  label,
  glyph,
  active,
  open,
  onPress,
}: {
  label: string;
  glyph: string;
  active: boolean;
  open: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const glow = active || open;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className={`mr-2 h-10 w-10 items-center justify-center rounded-xl border ${
        glow ? 'border-[#818CF8] bg-[#818CF8]/25' : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      <Text className={`text-base ${glow ? 'text-[#C7D2FE]' : 'text-neutral-400'}`}>{glyph}</Text>
    </Pressable>
  );
}

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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={4}
      className={`mb-2 mr-2 rounded-full border px-3 py-1.5 ${
        selected ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      <Text className={`text-sm ${selected ? 'text-[#818CF8]' : 'text-neutral-300'}`}>{label}</Text>
    </Pressable>
  );
}

export function CollectionFilterBar({
  filters,
  sort,
  openPanel,
  onChangeFilters,
  onChangeSort,
  onChangePanel,
}: Props): React.JSX.Element {
  const C = Copy.collection;

  function togglePanel(panel: Exclude<OpenPanel, null>) {
    onChangePanel(openPanel === panel ? null : panel);
  }

  return (
    <View className="px-4 pb-2">
      <TextInput
        className="mb-2 rounded-xl bg-[#1F1F1F] px-4 py-2.5 text-sm text-[#F9F9F9]"
        placeholder={C.listSearchPlaceholder}
        placeholderTextColor="#525252"
        value={filters.nameQuery}
        onChangeText={(nameQuery) => onChangeFilters({ nameQuery })}
        autoCorrect={false}
        returnKeyType="search"
      />

      <View className="mb-2 flex-row items-center">
        <FilterIcon
          label={C.filterPlayers}
          glyph="P"
          active={filters.playerCount !== undefined}
          open={openPanel === 'players'}
          onPress={() => togglePanel('players')}
        />
        <FilterIcon
          label={C.filterComplexity}
          glyph="W"
          active={filters.complexity !== undefined}
          open={openPanel === 'complexity'}
          onPress={() => togglePanel('complexity')}
        />
        <FilterIcon
          label={C.filterPlayTime}
          glyph="T"
          active={filters.playTime !== undefined}
          open={openPanel === 'playTime'}
          onPress={() => togglePanel('playTime')}
        />
        <FilterIcon
          label={C.filterTags}
          glyph="#"
          active={filters.tag !== undefined}
          open={openPanel === 'tags'}
          onPress={() => togglePanel('tags')}
        />
        <View className="flex-1" />
        <Pressable
          onPress={() => onChangeFilters({ showExpansions: !filters.showExpansions })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: filters.showExpansions }}
          hitSlop={8}
          className="flex-row items-center"
        >
          <View
            className={`mr-2 h-4 w-4 items-center justify-center rounded border ${
              filters.showExpansions ? 'border-[#818CF8] bg-[#818CF8]' : 'border-[#525252]'
            }`}
          >
            {filters.showExpansions ? <Text className="text-[10px] text-white">✓</Text> : null}
          </View>
          <Text className="text-xs text-neutral-400">{C.showExpansions}</Text>
        </Pressable>
      </View>

      {openPanel === 'players' ? (
        <View className="mb-2 flex-row flex-wrap rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2">
          {PLAYER_OPTS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={filters.playerCount === opt}
              onPress={() =>
                onChangeFilters({
                  playerCount: filters.playerCount === opt ? undefined : opt,
                })
              }
            />
          ))}
        </View>
      ) : null}
      {openPanel === 'complexity' ? (
        <View className="mb-2 flex-row flex-wrap rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2">
          {COMPLEXITY_OPTS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={filters.complexity === opt}
              onPress={() =>
                onChangeFilters({
                  complexity: filters.complexity === opt ? undefined : opt,
                })
              }
            />
          ))}
        </View>
      ) : null}
      {openPanel === 'playTime' ? (
        <View className="mb-2 flex-row flex-wrap rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2">
          {PLAY_TIME_OPTS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={filters.playTime === opt}
              onPress={() =>
                onChangeFilters({
                  playTime: filters.playTime === opt ? undefined : opt,
                })
              }
            />
          ))}
        </View>
      ) : null}
      {openPanel === 'tags' ? (
        <View className="mb-2 flex-row flex-wrap rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2">
          {TAG_OPTS.map((opt) => (
            <Chip
              key={opt}
              label={opt}
              selected={filters.tag === opt}
              onPress={() => onChangeFilters({ tag: filters.tag === opt ? undefined : opt })}
            />
          ))}
          {filters.tag !== undefined && !(TAG_OPTS as readonly string[]).includes(filters.tag) ? (
            <Chip
              label={filters.tag}
              selected
              onPress={() => onChangeFilters({ tag: undefined })}
            />
          ) : null}
        </View>
      ) : null}

      <View className="flex-row flex-wrap">
        {SORT_OPTS.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => onChangeSort(opt.id)}
            accessibilityRole="button"
            hitSlop={4}
            className={`mb-1 mr-2 rounded-full border px-2.5 py-1 ${
              sort === opt.id ? 'border-[#818CF8] bg-[#818CF8]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'
            }`}
          >
            <Text className={`text-xs ${sort === opt.id ? 'text-[#C7D2FE]' : 'text-neutral-500'}`}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
