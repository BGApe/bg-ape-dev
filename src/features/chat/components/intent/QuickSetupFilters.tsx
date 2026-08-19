import type React from 'react';
import { useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { CollectionGame } from '@/features/collection/types';

import { BggGameInput } from './BggGameInput';
import { CollectionPicker } from './CollectionPicker';

const C = Copy.intent.quickSetup;

type DepthId = (typeof C.depthOptions)[number]['id'];

type State = {
  fromCollection: boolean;
  selectedGameId: string | undefined;
  gameName: string;
  depth: DepthId | undefined;
};

const INITIAL: State = {
  fromCollection: false,
  selectedGameId: undefined,
  gameName: '',
  depth: undefined,
};

type Props = {
  games: CollectionGame[];
  onPromptChange: (prompt: string) => void;
};

function buildPrompt(state: State, games: CollectionGame[]): string {
  const P = C.promptParts;
  const gameName = state.fromCollection
    ? (games.find((g) => g.id === state.selectedGameId)?.name ?? '')
    : state.gameName.trim();

  const parts: string[] = [P.intro(gameName)];
  if (state.depth) parts.push(P.depth[state.depth] ?? '');
  return parts.join(' ');
}

export function QuickSetupFilters({ games, onPromptChange }: Props): React.JSX.Element {
  const [state, setState] = useState<State>(INITIAL);

  function update(patch: Partial<State>) {
    const next = { ...state, ...patch };
    setState(next);
    onPromptChange(buildPrompt(next, games));
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Collection toggle */}
      <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
        <Text className="text-sm text-[#F9F9F9]">{C.fromCollectionLabel}</Text>
        <Switch
          value={state.fromCollection}
          onValueChange={(v) =>
            update({ fromCollection: v, selectedGameId: undefined, gameName: '' })
          }
          trackColor={{ false: '#2A2A2A', true: '#818CF8' }}
          thumbColor="#F9F9F9"
        />
      </View>

      {/* Game selection */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Game</Text>
      <View className="mb-4">
        {state.fromCollection ? (
          <CollectionPicker
            games={games}
            selectedId={state.selectedGameId}
            onSelect={(id) => update({ selectedGameId: id })}
          />
        ) : (
          <BggGameInput
            value={state.gameName}
            onChange={(v) => update({ gameName: v })}
            placeholder={C.gameNamePlaceholder}
          />
        )}
      </View>

      {/* Depth */}
      <Text className="mb-3 text-xs uppercase tracking-wide text-neutral-500">{C.depthLabel}</Text>
      <View className="gap-2">
        {C.depthOptions.map((opt) => {
          const sel = state.depth === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => update({ depth: sel ? undefined : opt.id })}
              accessibilityRole="radio"
              className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
                sel ? 'border-[#818CF8] bg-[#818CF8]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <View
                className={`h-4 w-4 rounded-full border-2 ${
                  sel ? 'border-[#818CF8] bg-[#818CF8]' : 'border-neutral-500'
                }`}
              />
              <Text className={`text-sm ${sel ? 'text-[#818CF8]' : 'text-neutral-300'}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
