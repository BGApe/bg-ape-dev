import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { ActivityBias } from '@/features/assistant/types';
import type { CollectionGame } from '@/features/collection/types';

import { resolveGamePickerTags, searchGamePickerTags } from '../../lib/bggTagOptions';
import {
  pickerScopeSentences,
  tastePromptSentences,
  type ConflictStyle,
  type DesignStyle,
  type KidsAge,
} from '../../lib/gamePickerTaste';

const C = Copy.intent.gamePicker;

type Complexity = (typeof C.complexityOptions)[number];
type PlayTime = (typeof C.playTimeOptions)[number];
type TableSize = (typeof C.tableSizeOptions)[number];
type ActivityOption = (typeof C.activityBiasOptions)[number];

type State = {
  fromCollection: boolean;
  activityBias: ActivityBias;
  playerCount: string;
  complexity: Complexity | undefined;
  playTime: PlayTime | undefined;
  conflict?: ConflictStyle;
  design?: DesignStyle;
  storyDriven?: boolean;
  areaControl: boolean;
  economic: boolean;
  coolMinis: boolean;
  kidsFriendly: boolean;
  kidsAge?: KidsAge;
  cardGame: boolean;
  activityGame: boolean;
  extraTags: string[];
  tableSize: TableSize | undefined;
  notes: string;
};

const INITIAL: State = {
  fromCollection: false,
  activityBias: 'none',
  playerCount: '',
  complexity: undefined,
  playTime: undefined,
  areaControl: false,
  economic: false,
  coolMinis: false,
  kidsFriendly: false,
  cardGame: false,
  activityGame: false,
  extraTags: [],
  tableSize: undefined,
  notes: '',
};

type Props = {
  games: CollectionGame[];
  onPromptChange: (prompt: string) => void;
};

function buildPrompt(state: State): string {
  const P = C.promptParts;
  const parts: string[] = [P.intro];

  if (state.playerCount.trim()) parts.push(P.players(state.playerCount.trim()));
  if (state.complexity) parts.push(P.complexity(state.complexity));
  if (state.playTime) parts.push(P.playTime(state.playTime));
  parts.push(
    ...tastePromptSentences({
      ...(state.conflict !== undefined ? { conflict: state.conflict } : {}),
      ...(state.design !== undefined ? { design: state.design } : {}),
      ...(state.storyDriven !== undefined ? { storyDriven: state.storyDriven } : {}),
      areaControl: state.areaControl,
      economic: state.economic,
      coolMinis: state.coolMinis,
      kidsFriendly: state.kidsFriendly,
      ...(state.kidsAge !== undefined ? { kidsAge: state.kidsAge } : {}),
      cardGame: state.cardGame,
      activityGame: state.activityGame,
      extraTags: state.extraTags,
    }),
  );
  parts.push(...pickerScopeSentences(state.fromCollection));
  if (state.tableSize) parts.push(P.tableSize(state.tableSize));
  if (state.activityBias !== 'none') {
    parts.push(P.activityBias[state.activityBias]);
  }
  if (state.notes.trim()) parts.push(state.notes.trim());
  return parts.join(' ');
}

function Chip({
  label,
  selected,
  onPress,
  dense = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  dense?: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className={`rounded-full border ${
        dense ? 'mr-1.5 mb-1.5 px-2.5 py-1' : 'mr-2 mb-2 px-3 py-1.5'
      } ${selected ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A] bg-[#1A1A1A]'}`}
    >
      <Text className={`text-sm ${selected ? 'text-[#818CF8]' : 'text-neutral-300'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GamePickerFilters({ games, onPromptChange }: Props): React.JSX.Element {
  const [state, setState] = useState<State>(INITIAL);
  const [tagQuery, setTagQuery] = useState('');
  const onPromptChangeRef = useRef(onPromptChange);
  onPromptChangeRef.current = onPromptChange;
  useEffect(() => {
    onPromptChangeRef.current(buildPrompt(INITIAL));
  }, []);
  const tagOptions = useMemo(() => resolveGamePickerTags(games), [games]);
  const tagMatches = useMemo(
    () =>
      searchGamePickerTags(tagOptions, tagQuery).filter((tag) => !state.extraTags.includes(tag)),
    [tagOptions, tagQuery, state.extraTags],
  );

  function update(
    patch: Partial<State>,
    clear: ('conflict' | 'design' | 'storyDriven' | 'kidsAge')[] = [],
  ) {
    const next: State = { ...state, ...patch };
    for (const key of clear) delete next[key];
    setState(next);
    onPromptChange(buildPrompt(next));
  }

  function toggleExtraTag(tag: string) {
    const has = state.extraTags.includes(tag);
    update({
      extraTags: has ? state.extraTags.filter((item) => item !== tag) : [...state.extraTags, tag],
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
      <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
        <View className="mr-3 flex-1">
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

      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{C.tasteLabel}</Text>
      <View className="mb-3 flex-row flex-wrap">
        {C.conflictOptions.map((opt) => (
          <Chip
            key={opt.id}
            dense
            label={opt.label}
            selected={state.conflict === opt.id}
            onPress={() =>
              state.conflict === opt.id ? update({}, ['conflict']) : update({ conflict: opt.id })
            }
          />
        ))}
        {C.designOptions.map((opt) => (
          <Chip
            key={opt.id}
            dense
            label={opt.label}
            selected={state.design === opt.id}
            onPress={() =>
              state.design === opt.id ? update({}, ['design']) : update({ design: opt.id })
            }
          />
        ))}
        <Chip
          dense
          label={C.storyLabel}
          selected={state.storyDriven === true}
          onPress={() =>
            state.storyDriven === true ? update({}, ['storyDriven']) : update({ storyDriven: true })
          }
        />
        <Chip
          dense
          label={C.areaControl}
          selected={state.areaControl}
          onPress={() => update({ areaControl: !state.areaControl })}
        />
        <Chip
          dense
          label={C.economic}
          selected={state.economic}
          onPress={() => update({ economic: !state.economic })}
        />
        <Chip
          dense
          label={C.coolMinis}
          selected={state.coolMinis}
          onPress={() => update({ coolMinis: !state.coolMinis })}
        />
        <Chip
          dense
          label={C.kidsFriendly}
          selected={state.kidsFriendly}
          onPress={() =>
            state.kidsFriendly
              ? update({ kidsFriendly: false }, ['kidsAge'])
              : update({ kidsFriendly: true })
          }
        />
        <Chip
          dense
          label={C.cardGame}
          selected={state.cardGame}
          onPress={() => update({ cardGame: !state.cardGame })}
        />
        <Chip
          dense
          label={C.activityGame}
          selected={state.activityGame}
          onPress={() => update({ activityGame: !state.activityGame })}
        />
      </View>
      {state.kidsFriendly && (
        <>
          <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            {C.kidsAgeLabel}
          </Text>
          <View className="mb-4 flex-row flex-wrap">
            {C.kidsAgeOptions.map((opt) => (
              <Chip
                key={opt.id}
                label={opt.label}
                selected={state.kidsAge === opt.id}
                onPress={() =>
                  state.kidsAge === opt.id ? update({}, ['kidsAge']) : update({ kidsAge: opt.id })
                }
              />
            ))}
          </View>
        </>
      )}

      <Text className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
        {C.activityBiasLabel}
      </Text>
      <Text className="mb-2 text-xs text-neutral-500">{C.activityBiasHint}</Text>
      <View className="mb-4 flex-row flex-wrap">
        {C.activityBiasOptions.map((opt: ActivityOption) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={state.activityBias === opt.id}
            onPress={() => update({ activityBias: opt.id })}
          />
        ))}
      </View>

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

      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.moreFiltersLabel}
      </Text>
      <TextInput
        className="mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
        placeholder={C.moreFiltersPlaceholder}
        placeholderTextColor="#525252"
        value={tagQuery}
        onChangeText={setTagQuery}
        returnKeyType="search"
      />
      {state.extraTags.length > 0 && (
        <View className="mb-2 flex-row flex-wrap">
          {state.extraTags.map((tag) => (
            <Chip key={tag} label={tag} selected onPress={() => toggleExtraTag(tag)} />
          ))}
        </View>
      )}
      {tagMatches.length > 0 && (
        <View className="mb-4 flex-row flex-wrap">
          {tagMatches.map((tag) => (
            <Chip key={tag} label={tag} selected={false} onPress={() => toggleExtraTag(tag)} />
          ))}
        </View>
      )}

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
