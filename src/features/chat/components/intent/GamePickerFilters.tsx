import type React from 'react';
import { useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';

const C = Copy.intent.gamePicker;

type Complexity = (typeof C.complexityOptions)[number];
type PlayTime = (typeof C.playTimeOptions)[number];
type Category = (typeof C.categoryOptions)[number];
type TableSize = (typeof C.tableSizeOptions)[number];

type State = {
  fromCollection: boolean;
  playerCount: string;
  complexity: Complexity | undefined;
  playTime: PlayTime | undefined;
  categories: Category[];
  tableSize: TableSize | undefined;
  notes: string;
};

const INITIAL: State = {
  fromCollection: false,
  playerCount: '',
  complexity: undefined,
  playTime: undefined,
  categories: [],
  tableSize: undefined,
  notes: '',
};

type Props = {
  onPromptChange: (prompt: string) => void;
};

function buildPrompt(state: State): string {
  const P = C.promptParts;
  const parts: string[] = [P.intro];

  if (state.playerCount.trim()) parts.push(P.players(state.playerCount.trim()));
  if (state.complexity) parts.push(P.complexity(state.complexity));
  if (state.playTime) parts.push(P.playTime(state.playTime));
  if (state.categories.length > 0) parts.push(P.categories(state.categories as string[]));
  if (state.tableSize) parts.push(P.tableSize(state.tableSize));
  if (state.fromCollection) parts.push(P.fromCollection);
  if (state.notes.trim()) parts.push(state.notes.trim());
  return parts.join(' ');
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
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className={`mr-2 mb-2 rounded-full border px-3 py-1.5 ${
        selected ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      <Text className={`text-sm ${selected ? 'text-[#818CF8]' : 'text-neutral-300'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GamePickerFilters({ onPromptChange }: Props): React.JSX.Element {
  const [state, setState] = useState<State>(INITIAL);

  function update(patch: Partial<State>) {
    const next = { ...state, ...patch };
    setState(next);
    onPromptChange(buildPrompt(next));
  }

  function toggleCategory(cat: Category) {
    const has = state.categories.includes(cat);
    update({
      categories: has ? state.categories.filter((c) => c !== cat) : [...state.categories, cat],
    });
  }

  const playerChips = ['1', '2', '3', '4', '5', '6', '6+'];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* From my collection — plain toggle only */}
      <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
        <View>
          <Text className="text-sm text-[#F9F9F9]">{C.fromCollectionLabel}</Text>
          <Text className="mt-0.5 text-xs text-neutral-500">{C.fromCollectionHint}</Text>
        </View>
        <Switch
          value={state.fromCollection}
          onValueChange={(v) => update({ fromCollection: v })}
          trackColor={{ false: '#2A2A2A', true: '#818CF8' }}
          thumbColor="#F9F9F9"
        />
      </View>

      {/* Players */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.playersLabel}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row">
          {playerChips.map((n) => (
            <Chip
              key={n}
              label={n}
              selected={state.playerCount === n}
              onPress={() => update({ playerCount: state.playerCount === n ? '' : n })}
            />
          ))}
        </View>
      </ScrollView>

      {/* Complexity */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.complexityLabel}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {C.complexityOptions.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={state.complexity === opt}
            onPress={() => update({ complexity: state.complexity === opt ? undefined : opt })}
          />
        ))}
      </View>

      {/* Play time */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.playTimeLabel}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {C.playTimeOptions.map((opt) => (
          <Chip
            key={opt}
            label={`${opt} min`}
            selected={state.playTime === opt}
            onPress={() => update({ playTime: state.playTime === opt ? undefined : opt })}
          />
        ))}
      </View>

      {/* Category / Mechanics */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.categoryLabel}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {C.categoryOptions.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={state.categories.includes(opt)}
            onPress={() => toggleCategory(opt)}
          />
        ))}
      </View>

      {/* Table size */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.tableSizeLabel}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {C.tableSizeOptions.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={state.tableSize === opt}
            onPress={() => update({ tableSize: state.tableSize === opt ? undefined : opt })}
          />
        ))}
      </View>

      {/* Notes */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{C.notesLabel}</Text>
      <TextInput
        className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
        placeholder={C.notesPlaceholder}
        placeholderTextColor="#525252"
        value={state.notes}
        onChangeText={(v) => update({ notes: v })}
        returnKeyType="done"
      />
    </ScrollView>
  );
}
