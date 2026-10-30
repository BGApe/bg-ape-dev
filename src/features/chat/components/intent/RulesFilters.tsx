import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { useBggGameProfile } from '@/features/collection/hooks/useBggGameProfile';
import type { CollectionGame } from '@/features/collection/types';
import type { RulesFaqItem } from '@/services/bgg/gameProfile';
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
  /** Prefill a game that is not in the collection. */
  initialGameName?: string;
  /** Preselect one of the topic chips. */
  initialTopic?: string;
  /** Prefill the free-text question (table setup, cards, and so on). */
  initialQuestion?: string;
  /** Load the shared rules FAQ immediately. */
  startWithFaq?: boolean;
  onSelectFaq?: (item: RulesFaqItem) => void;
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

function topicOrEmpty(topic: string | undefined): Topic[] {
  if (topic === undefined) return [];
  return (C.topicOptions as readonly string[]).includes(topic) ? [topic as Topic] : [];
}

export function RulesFilters({
  games,
  onPromptChange,
  onContextChange,
  initialGameId,
  initialGameName,
  initialTopic,
  initialQuestion,
  startWithFaq = false,
  onSelectFaq,
}: Props): React.JSX.Element {
  const baseGames = useMemo(() => {
    const bases = games.filter((g) => g.kind !== 'expansion');
    if (initialGameId === undefined) return bases;
    const selected = games.find((g) => g.id === initialGameId);
    if (selected !== undefined && selected.kind === 'expansion') return [selected, ...bases];
    return bases;
  }, [games, initialGameId]);

  const [state, setState] = useState<State>(() => {
    const topics = topicOrEmpty(initialTopic);
    const question = initialQuestion ?? '';
    if (initialGameId) {
      return {
        fromCollection: true,
        selectedGameId: initialGameId,
        gameName: '',
        topics,
        question,
      };
    }
    return {
      fromCollection: false,
      selectedGameId: undefined,
      gameName: initialGameName ?? '',
      topics,
      question,
    };
  });
  const [faqRequested, setFaqRequested] = useState(startWithFaq);

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
      topics: topicOrEmpty(initialTopic),
      question: initialQuestion ?? '',
    };
    onPromptChangeRef.current(buildPrompt(preselected, baseGames));
    onContextChangeRef.current?.(selectionFromState(preselected, baseGames));
  }, [baseGames, initialGameId, initialQuestion, initialTopic]);

  useEffect(() => {
    if (initialGameId || didSyncPreselect.current) return;
    if (!initialGameName && !initialQuestion && !initialTopic) return;
    didSyncPreselect.current = true;
    onPromptChangeRef.current(buildPrompt(state, baseGames));
    onContextChangeRef.current?.(selectionFromState(state, baseGames));
  }, [baseGames, initialGameId, initialGameName, initialQuestion, initialTopic, state]);

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

  const selectedGame = state.selectedGameId
    ? baseGames.find((game) => game.id === state.selectedGameId)
    : undefined;
  const faqName = state.fromCollection ? selectedGame?.name : state.gameName.trim();
  const profileQuery = useBggGameProfile(
    faqRequested && faqName !== undefined && faqName.length > 2
      ? selectedGame?.bggId !== undefined
        ? { bggId: selectedGame.bggId }
        : { name: faqName }
      : null,
  );

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

      <View className="mb-4">
        <Text className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{C.faqTitle}</Text>
        <Text className="mb-2 text-xs text-neutral-500">{C.faqHint}</Text>
        {!faqRequested ? (
          <TouchableOpacity
            onPress={() => setFaqRequested(true)}
            disabled={!faqName}
            accessibilityRole="button"
            className={`self-start rounded-full border px-3 py-1.5 ${
              faqName ? 'border-[#818CF8]' : 'border-[#2A2A2A]'
            }`}
          >
            <Text className={`text-sm ${faqName ? 'text-[#C7D2FE]' : 'text-neutral-600'}`}>
              {C.faqLoad}
            </Text>
          </TouchableOpacity>
        ) : profileQuery.isFetching ? (
          <Text className="text-sm text-neutral-400">{C.faqLoading}</Text>
        ) : profileQuery.isError ? (
          <Text className="text-sm text-red-400">{C.faqError}</Text>
        ) : (profileQuery.data?.rulesFaq.length ?? 0) === 0 ? (
          <Text className="text-sm text-neutral-400">{C.faqEmpty}</Text>
        ) : (
          <View className="gap-2">
            {profileQuery.data?.rulesFaq.map((item) => (
              <TouchableOpacity
                key={item.question}
                onPress={() => onSelectFaq?.(item)}
                accessibilityRole="button"
                className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
              >
                <Text className="text-sm text-[#F9F9F9]">{item.question}</Text>
                <Text className="mt-1 text-xs leading-relaxed text-neutral-400">{item.answer}</Text>
                <Text className="mt-2 text-xs text-[#818CF8]">{C.faqOpen}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
