import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { CollectionGame } from '@/features/collection/types';
import type { GameId } from '@/types';

import { BggGameInput } from './BggGameInput';
import { CollectionPicker } from './CollectionPicker';

const C = Copy.intent.quickSetup;

type DepthId = (typeof C.depthOptions)[number]['id'];

export type IntentGameSelection = {
  gameId?: GameId;
  gameName?: string;
  /** Setup only — required unless reused from a recent recommendation. */
  playerCount?: string;
};

type State = {
  fromCollection: boolean;
  selectedGameId: string | undefined;
  gameName: string;
  playerCount: string;
  depth: DepthId | undefined;
  /** True once the user taps a player chip (blocks overwriting from session reuse). */
  playerCountTouched: boolean;
};

type Props = {
  games: CollectionGame[];
  onPromptChange: (prompt: string) => void;
  onContextChange?: (ctx: IntentGameSelection) => void;
  /** Preselect a collection game (e.g. from game detail → Quick setup). */
  initialGameId?: GameId;
  /** Prefill a game that is not in the collection (typed or recommended by name). */
  initialGameName?: string;
  /** Player count carried from the game picker. Wins over session reuse. */
  initialPlayerCount?: string;
  /**
   * Player count from a recent recommendation for this game (same session, ≤2h).
   * When set, chips are prefilled; when absent, player count is required.
   */
  sessionPlayerCount?: string;
};

function resolveGameName(state: State, games: CollectionGame[]): string {
  return state.fromCollection
    ? (games.find((g) => g.id === state.selectedGameId)?.name ?? '')
    : state.gameName.trim();
}

function buildPrompt(state: State, games: CollectionGame[]): string {
  const P = C.promptParts;
  const parts: string[] = [P.intro(resolveGameName(state, games))];
  if (state.playerCount.trim()) parts.push(P.players(state.playerCount.trim()));
  if (state.depth) parts.push(P.depth[state.depth] ?? '');
  return parts.join(' ');
}

function selectionFromState(state: State, games: CollectionGame[]): IntentGameSelection {
  const ctx: IntentGameSelection = {};
  if (state.fromCollection && state.selectedGameId) {
    const game = games.find((g) => g.id === state.selectedGameId);
    if (game) {
      ctx.gameId = game.id;
      ctx.gameName = game.name;
    }
  } else {
    const name = state.gameName.trim();
    if (name) ctx.gameName = name;
  }
  if (state.playerCount.trim()) ctx.playerCount = state.playerCount.trim();
  return ctx;
}

export function QuickSetupFilters({
  games,
  onPromptChange,
  onContextChange,
  initialGameId,
  initialGameName,
  initialPlayerCount,
  sessionPlayerCount,
}: Props): React.JSX.Element {
  const baseGames = useMemo(() => {
    const bases = games.filter((g) => g.kind !== 'expansion');
    if (initialGameId === undefined) return bases;
    const selected = games.find((g) => g.id === initialGameId);
    if (selected !== undefined && selected.kind === 'expansion') return [selected, ...bases];
    return bases;
  }, [games, initialGameId]);

  const [state, setState] = useState<State>(() => {
    const playerCount = initialPlayerCount ?? '';
    const playerCountTouched = initialPlayerCount !== undefined && initialPlayerCount.length > 0;
    if (initialGameId) {
      return {
        fromCollection: true,
        selectedGameId: initialGameId,
        gameName: '',
        playerCount,
        depth: undefined,
        playerCountTouched,
      };
    }
    return {
      fromCollection: false,
      selectedGameId: undefined,
      gameName: initialGameName ?? '',
      playerCount,
      depth: undefined,
      playerCountTouched,
    };
  });

  const onPromptChangeRef = useRef(onPromptChange);
  const onContextChangeRef = useRef(onContextChange);
  const didSyncPreselect = useRef(false);
  onPromptChangeRef.current = onPromptChange;
  onContextChangeRef.current = onContextChange;

  // When opened from game detail, emit prompt/context once the collection includes the game.
  useEffect(() => {
    if (!initialGameId || didSyncPreselect.current) return;
    if (!baseGames.some((g) => g.id === initialGameId)) return;
    didSyncPreselect.current = true;
    const preselected: State = {
      fromCollection: true,
      selectedGameId: initialGameId,
      gameName: '',
      playerCount: state.playerCount,
      depth: undefined,
      playerCountTouched: state.playerCountTouched,
    };
    onPromptChangeRef.current(buildPrompt(preselected, baseGames));
    onContextChangeRef.current?.(selectionFromState(preselected, baseGames));
  }, [baseGames, initialGameId, state.playerCount, state.playerCountTouched]);

  // Name-only handoff (recommended game that is not in the collection).
  useEffect(() => {
    if (initialGameId || didSyncPreselect.current) return;
    if (!initialGameName && !initialPlayerCount) return;
    didSyncPreselect.current = true;
    onPromptChangeRef.current(buildPrompt(state, baseGames));
    onContextChangeRef.current?.(selectionFromState(state, baseGames));
  }, [baseGames, initialGameId, initialGameName, initialPlayerCount, state]);

  // Prefill from a same-session recommendation unless the user already chose a count.
  useEffect(() => {
    if (!sessionPlayerCount || state.playerCountTouched) return;
    if (state.playerCount === sessionPlayerCount) return;
    const next = { ...state, playerCount: sessionPlayerCount };
    setState(next);
    onPromptChange(buildPrompt(next, baseGames));
    onContextChange?.(selectionFromState(next, baseGames));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to session reuse signal
  }, [sessionPlayerCount]);

  function update(patch: Partial<State>) {
    const next = { ...state, ...patch };
    setState(next);
    onPromptChange(buildPrompt(next, baseGames));
    onContextChange?.(selectionFromState(next, baseGames));
  }

  const playerChips = ['1', '2', '3', '4', '5', '6', '6+'];
  const playerFromSession =
    Boolean(sessionPlayerCount) &&
    state.playerCount === sessionPlayerCount &&
    !state.playerCountTouched;

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

      {/* Players — required unless reused from a recent recommendation */}
      <Text className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
        {C.playersLabel}
      </Text>
      <Text className="mb-2 text-xs text-neutral-500">
        {playerFromSession ? C.playersFromSessionHint : C.playersRequiredHint}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {playerChips.map((n) => {
          const sel = state.playerCount === n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() =>
                update({
                  playerCount: sel ? '' : n,
                  playerCountTouched: true,
                })
              }
              accessibilityRole="button"
              className={`mr-2 mb-2 rounded-full border px-3 py-1.5 ${
                sel ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <Text className={`text-sm ${sel ? 'text-[#818CF8]' : 'text-neutral-300'}`}>{n}</Text>
            </TouchableOpacity>
          );
        })}
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
