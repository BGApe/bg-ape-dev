import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { CollectionGame } from '@/features/collection/types';
import type { GameId } from '@/types';

import { BggGameInput } from './BggGameInput';
import { CollectionPicker } from './CollectionPicker';
import type { IntentGameSelection } from './QuickSetupFilters';

const C = Copy.intent.rulesHelper;

type Topic = (typeof C.topicOptions)[number];

type State = {
  fromCollection: boolean;
  selectedGameId: string | undefined;
  gameName: string;
  topics: Topic[];
  question: string;
};

type Props = {
  games: CollectionGame[];
  onPromptChange: (prompt: string) => void;
  onContextChange?: (ctx: IntentGameSelection) => void;
  /** Preselect a collection game (e.g. from game detail → Rules help). */
  initialGameId?: GameId;
};

function resolveGameName(state: State, games: CollectionGame[]): string {
  return state.fromCollection
    ? (games.find((g) => g.id === state.selectedGameId)?.name ?? '')
    : state.gameName.trim();
}

function buildPrompt(state: State, games: CollectionGame[]): string {
  const P = C.promptParts;
  const parts: string[] = [P.intro(resolveGameName(state, games))];
  if (state.topics.length > 0) parts.push(P.topics(state.topics as string[]));
  if (state.question.trim()) parts.push(P.question(state.question.trim()));
  return parts.join(' ');
}

function selectionFromState(state: State, games: CollectionGame[]): IntentGameSelection {
  if (state.fromCollection && state.selectedGameId) {
    const game = games.find((g) => g.id === state.selectedGameId);
    if (game) return { gameId: game.id, gameName: game.name };
  }
  const name = state.gameName.trim();
  if (!state.fromCollection && name) return { gameName: name };
  return {};
}

export function RulesFilters({
  games,
  onPromptChange,
  onContextChange,
  initialGameId,
}: Props): React.JSX.Element {
  const baseGames = useMemo(() => games.filter((g) => g.kind !== 'expansion'), [games]);

  const [state, setState] = useState<State>(() => {
    if (initialGameId) {
      return {
        fromCollection: true,
        selectedGameId: initialGameId,
        gameName: '',
        topics: [],
        question: '',
      };
    }
    return {
      fromCollection: false,
      selectedGameId: undefined,
      gameName: '',
      topics: [],
      question: '',
    };
  });

  const onPromptChangeRef = useRef(onPromptChange);
  const onContextChangeRef = useRef(onContextChange);
  const didSyncPreselect = useRef(false);
  onPromptChangeRef.current = onPromptChange;
  onContextChangeRef.current = onContextChange;

  useEffect(() => {
    if (!initialGameId || didSyncPreselect.current) return;
    if (!baseGames.some((g) => g.id === initialGameId)) return;
    didSyncPreselect.current = true;
    const preselected: State = {
      fromCollection: true,
      selectedGameId: initialGameId,
      gameName: '',
      topics: [],
      question: '',
    };
    onPromptChangeRef.current(buildPrompt(preselected, baseGames));
    onContextChangeRef.current?.(selectionFromState(preselected, baseGames));
  }, [baseGames, initialGameId]);

  function update(patch: Partial<State>) {
    const next = { ...state, ...patch };
    setState(next);
    onPromptChange(buildPrompt(next, baseGames));
    onContextChange?.(selectionFromState(next, baseGames));
  }

  function toggleTopic(topic: Topic) {
    const has = state.topics.includes(topic);
    update({ topics: has ? state.topics.filter((t) => t !== topic) : [...state.topics, topic] });
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
            games={baseGames}
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

      {/* Topics */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">{C.topicsLabel}</Text>
      <View className="mb-4 flex-row flex-wrap">
        {C.topicOptions.map((topic) => {
          const sel = state.topics.includes(topic);
          return (
            <TouchableOpacity
              key={topic}
              onPress={() => toggleTopic(topic)}
              accessibilityRole="checkbox"
              className={`mr-2 mb-2 rounded-full border px-3 py-1.5 ${
                sel ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <Text className={`text-sm ${sel ? 'text-[#818CF8]' : 'text-neutral-300'}`}>
                {topic}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Specific question */}
      <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
        {C.questionLabel}
      </Text>
      <TextInput
        className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
        placeholder={C.questionPlaceholder}
        placeholderTextColor="#525252"
        value={state.question}
        onChangeText={(v) => update({ question: v })}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />
    </ScrollView>
  );
}
