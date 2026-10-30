import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/BarChart';
import { MetaChip } from '@/components/MetaChip';
import { Copy } from '@/constants/copy';
import { QueryKeys } from '@/constants/queryKeys';
import { Routes } from '@/constants/routes';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { useCreateThread } from '@/features/chat/hooks/useCreateThread';
import { useThreads } from '@/features/chat/hooks/useThreads';
import { useUpdateThread } from '@/features/chat/hooks/useUpdateThread';
import { findGameThread, resolveGameAnchor } from '@/features/chat/lib/gameThread';
import type { ChatThread, NewChatThread } from '@/features/chat/types';
import { AddGameSheet } from '@/features/collection/components/AddGameSheet';
import { useAddGame } from '@/features/collection/hooks/useAddGame';
import { useBggThing } from '@/features/collection/hooks/useBggThing';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { useRemoveGame } from '@/features/collection/hooks/useRemoveGame';
import { useUpdateGame } from '@/features/collection/hooks/useUpdateGame';
import type { NewCollectionGame } from '@/features/collection/types';
import { useEnsureSelfPlayer } from '@/features/players/hooks/useEnsureSelfPlayer';
import { usePlays } from '@/features/plays/hooks/usePlays';
import {
  buildChart,
  formatLastPlayRelative,
  statsForGame,
} from '@/features/plays/lib/gamePlayStats';
import type { ChartMetric } from '@/features/plays/lib/gamePlayStats';
import { useChatUiStore } from '@/store/chatUiStore';
import type { GameId } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryFilter = {
  filter: 'all' | 'wins' | 'losses';
  showPlayers: boolean;
  showDuration: boolean;
  showLocation: boolean;
  showNote: boolean;
};

const CHART_METRICS: { key: ChartMetric; label: string }[] = [
  { key: 'plays', label: 'Plays' },
  { key: 'playtime', label: 'Playtime' },
  { key: 'winrate', label: 'Win rate' },
];

const CHART_TIMEFRAMES: { months: number; label: string }[] = [
  { months: 1, label: '1M' },
  { months: 3, label: '3M' },
  { months: 6, label: '6M' },
  { months: 12, label: '1Y' },
];

const COLUMN_TOGGLES = [
  { key: 'showPlayers' as const, label: 'Players' },
  { key: 'showDuration' as const, label: 'Duration' },
  { key: 'showLocation' as const, label: 'Location' },
  { key: 'showNote' as const, label: 'Note' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="mb-3 w-1/2 pr-3">
      <Text className="text-xs uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="mt-0.5 text-base text-[#F9F9F9]">{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GameDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: games = [] } = useCollection();
  const { user } = useAuthSession();
  const queryClient = useQueryClient();
  const { data: threads = [] } = useThreads();
  const updateThread = useUpdateThread();
  const createThread = useCreateThread();
  const setActiveThreadId = useChatUiStore((s) => s.setActiveThreadId);
  const setDiscussionFilter = useChatUiStore((s) => s.setDiscussionFilter);
  const setVersionSeed = useChatUiStore((s) => s.setVersionSeed);
  const { data: plays = [] } = usePlays();
  const self = useEnsureSelfPlayer();
  const updateGame = useUpdateGame();
  const removeGame = useRemoveGame();
  const addGame = useAddGame();

  const game = games.find((g) => g.id === id) ?? null;
  const { data: thing } = useBggThing(game?.bggId);

  // ── State & refs (must be before early return) ─────────────────────────────

  const [notes, setNotes] = useState(game?.notes ?? '');
  const [addingExpansion, setAddingExpansion] = useState(false);

  // Task 3 – scroll-to-play-history
  const scrollRef = useRef<ScrollView>(null);
  const playHistoryY = useRef<number>(0);

  // Task 4 – play history filter / column panel
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>({
    filter: 'all',
    showPlayers: true,
    showDuration: true,
    showLocation: true,
    showNote: true,
  });

  // Task 5 – chart metric / timeframe
  const [chartMetric, setChartMetric] = useState<ChartMetric>('plays');
  const [chartMonths, setChartMonths] = useState(6);

  // ── Owned expansions (useMemo before early return) ─────────────────────────
  const parentBggId = game?.bggId;
  const currentGameId = game?.id;
  const ownedExpansions = useMemo(() => {
    if (parentBggId === undefined || currentGameId === undefined) return [];
    return games.filter(
      (g) => g.kind === 'expansion' && g.parentBggId === parentBggId && g.id !== currentGameId,
    );
  }, [parentBggId, currentGameId, games]);

  // ── Early-return guard ─────────────────────────────────────────────────────
  if (game === null) {
    return (
      <View
        style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}
        className="items-center justify-center px-8"
      >
        <Text className="text-base text-neutral-400">{Copy.gameDetail.notFound}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-4 py-2">
          <Text className="text-sm text-[#818CF8]">‹ {Copy.tabs.collection}</Text>
        </Pressable>
      </View>
    );
  }

  // ── Derived data (after null guard) ───────────────────────────────────────

  const openGameChat = (kind: 'setup' | 'rules') => {
    const anchor = resolveGameAnchor({ gameId: game.id, gameName: game.name }, games);
    const existing = anchor !== null ? findGameThread(threads, anchor, games) : undefined;
    if (kind === 'rules') setVersionSeed(game.name);
    setDiscussionFilter(kind);
    if (existing !== undefined) {
      if (anchor !== null && existing.gameKey !== anchor.key) {
        updateThread.mutate({
          threadId: existing.id,
          patch: {
            gameKey: anchor.key,
            title: anchor.gameName,
            gameName: anchor.gameName,
            ...(anchor.gameId !== undefined ? { gameId: anchor.gameId } : {}),
          },
        });
      }
      setActiveThreadId(existing.id);
      router.push(Routes.gameChat);
      return;
    }
    if (kind === 'rules' && user !== null && anchor !== null) {
      const input: NewChatThread = {
        title: anchor.gameName,
        reason: 'general',
        gameKey: anchor.key,
        gameName: anchor.gameName,
      };
      if (anchor.gameId !== undefined) input.gameId = anchor.gameId;
      void createThread
        .mutateAsync(input)
        .then((created) => {
          queryClient.setQueryData<ChatThread[]>(QueryKeys.chat.threads(user.uid), (prev) => {
            const list = prev ?? [];
            if (list.some((item) => item.id === created.id)) return list;
            return [created, ...list];
          });
          setActiveThreadId(created.id);
          router.push(Routes.gameChat);
        })
        .catch(() => {
          Alert.alert(Copy.errors.generic);
        });
      return;
    }
    router.push({
      pathname: Routes.intent,
      params: { reason: kind, gameId: game.id, returnToGame: '1' },
    });
  };

  const gamePlays = plays
    .filter((p) => p.gameId === game.id)
    .sort((a, b) => b.playedAt - a.playedAt);

  const selfStats = statsForGame(plays, game.id, self?.id);

  // Task 5 – configurable chart
  const chartData = buildChart(plays, game.id, chartMetric, chartMonths, self?.id);

  const chartFormatValue =
    chartMetric === 'winrate'
      ? (v: number) => `${v}%`
      : chartMetric === 'playtime'
        ? (v: number) => `${v}m`
        : (v: number) => String(Math.round(v));

  // Task 4 – filtered play history
  const filteredGamePlays =
    historyFilter.filter === 'all'
      ? gamePlays
      : gamePlays.filter((play) => {
          if (self === undefined || play.participants === undefined) return true;
          const selfP = play.participants.find((p) => p.playerId === self.id);
          if (selfP === undefined) return true;
          return historyFilter.filter === 'wins' ? selfP.won : !selfP.won;
        });

  const minPlayers = game.minPlayers ?? thing?.minPlayers;
  const maxPlayers = game.maxPlayers ?? thing?.maxPlayers;
  const playingTime = game.playingTime ?? thing?.playingTime;
  const weight = game.averageWeight ?? thing?.averageWeight;
  const rating = game.bggRating ?? thing?.bggRating;
  const rank = game.bggRank ?? thing?.bggRank;
  const imageUrl = thing?.imageUrl ?? game.thumbnailUrl;
  const expansionCount = game.bggExpansionCount ?? thing?.expansionCount;

  const playersValue = Copy.collection.playersLabel(minPlayers, maxPlayers) || Copy.gameDetail.dash;
  const ownedNames = ownedExpansions.map((e) => e.name).join(' · ');

  const gameId: GameId = game.id;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleNotesBlur() {
    const trimmed = notes.trim();
    if (trimmed !== (game?.notes ?? '')) {
      updateGame.mutate({ gameId, patch: { notes: trimmed } });
    }
  }

  function handleRemove() {
    Alert.alert(Copy.collection.removeConfirmTitle, Copy.collection.removeConfirmBody, [
      { text: Copy.collection.cancel, style: 'cancel' },
      {
        text: Copy.collection.remove,
        style: 'destructive',
        onPress: () => {
          removeGame.mutate(gameId);
          router.back();
        },
      },
    ]);
  }

  function handleAddExpansion(newGame: NewCollectionGame) {
    const withParent: NewCollectionGame = {
      ...newGame,
      kind: 'expansion',
      ...(parentBggId !== undefined ? { parentBggId } : {}),
    };
    addGame.mutate(withParent);
    setAddingExpansion(false);
  }

  function scrollToPlayHistory() {
    scrollRef.current?.scrollTo({ y: playHistoryY.current, animated: true });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <Pressable
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel={Copy.tabs.collection}
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-[#F9F9F9]" numberOfLines={1}>
          {game.name}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {/* Hero row */}
        <View className="flex-row">
          {imageUrl !== undefined ? (
            <Image source={{ uri: imageUrl }} className="h-28 w-28 rounded-xl bg-[#2A2A2A]" />
          ) : (
            <View className="h-28 w-28 items-center justify-center rounded-xl bg-[#2A2A2A]">
              <Text className="text-4xl">🎲</Text>
            </View>
          )}
          <View className="ml-4 flex-1 justify-center">
            <Text className="text-xl font-bold text-[#F9F9F9]">{game.name}</Text>
            {game.yearPublished !== undefined && (
              <Text className="mt-1 text-sm text-neutral-500">{game.yearPublished}</Text>
            )}
            {ownedNames.length > 0 && (
              <Text className="mt-1 text-xs text-neutral-400" numberOfLines={3}>
                {Copy.gameDetail.ownedExpansionsSubtitle(ownedNames)}
              </Text>
            )}
          </View>
        </View>

        {/* Assistant entry points */}
        <View className="mt-4 flex-row gap-2">
          <Pressable
            onPress={() => openGameChat('setup')}
            accessibilityRole="button"
            className="flex-1 items-center rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3"
          >
            <Text className="text-sm font-medium text-[#818CF8]">
              {Copy.gameDetail.quickSetupButton}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => openGameChat('rules')}
            disabled={createThread.isPending}
            accessibilityRole="button"
            className="flex-1 items-center rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3"
          >
            <Text className="text-sm font-medium text-[#818CF8]">
              {Copy.gameDetail.rulesHelpButton}
            </Text>
          </Pressable>
        </View>

        {/* BGG Stats */}
        <Text className="mb-3 mt-6 text-base font-semibold text-[#F9F9F9]">
          {Copy.gameDetail.statsTitle}
        </Text>
        <View className="flex-row flex-wrap rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-4">
          <StatCell label={Copy.gameDetail.playersLabel} value={playersValue} />
          <StatCell
            label={Copy.gameDetail.playTimeLabel}
            value={
              playingTime !== undefined
                ? Copy.gameDetail.minutes(playingTime)
                : Copy.gameDetail.dash
            }
          />
          <StatCell
            label={Copy.gameDetail.weightLabel}
            value={
              weight !== undefined ? Copy.gameDetail.weightValue(weight) : Copy.gameDetail.dash
            }
          />
          <StatCell
            label={Copy.gameDetail.ratingLabel}
            value={
              rating !== undefined ? Copy.gameDetail.ratingValue(rating) : Copy.gameDetail.dash
            }
          />
          <StatCell
            label={Copy.gameDetail.rankLabel}
            value={rank !== undefined ? `#${rank}` : Copy.gameDetail.dash}
          />
          <StatCell label={Copy.gameDetail.playsLabel} value={String(selfStats.playCount)} />
        </View>

        {/* Play stats — tap to scroll to play history (Task 3) */}
        <Text className="mb-3 mt-6 text-base font-semibold text-[#F9F9F9]">
          {Copy.gameDetail.playStatsTitle}
        </Text>
        <Pressable onPress={scrollToPlayHistory} accessibilityRole="button">
          <View className="mb-3 flex-row flex-wrap rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-4">
            <StatCell label={Copy.gameDetail.playsLabel} value={String(selfStats.playCount)} />
            <StatCell label={Copy.gameDetail.winsLabel} value={String(selfStats.wins)} />
            <StatCell
              label={Copy.gameDetail.lastPlayLabel}
              value={formatLastPlayRelative(selfStats.lastPlayedAt, Copy.gameDetail.dash)}
            />
          </View>
        </Pressable>

        {/* Chart with metric + timeframe selectors (Task 5) */}
        <Text className="mb-2 text-sm text-neutral-400">{Copy.gameDetail.chartTitle}</Text>

        {/* Metric chips */}
        <View className="mb-2 flex-row flex-wrap gap-2">
          {CHART_METRICS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setChartMetric(key)}
              className={`rounded-full border px-3 py-1 ${
                chartMetric === key
                  ? 'border-[#818CF8] bg-[#818CF8]/20'
                  : 'border-[#2A2A2A] bg-transparent'
              }`}
            >
              <Text
                className={`text-xs ${chartMetric === key ? 'text-[#818CF8]' : 'text-neutral-500'}`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Timeframe chips */}
        <View className="mb-2 flex-row gap-2">
          {CHART_TIMEFRAMES.map(({ months, label }) => (
            <Pressable
              key={months}
              onPress={() => setChartMonths(months)}
              className={`rounded-full border px-3 py-1 ${
                chartMonths === months
                  ? 'border-[#818CF8] bg-[#818CF8]/20'
                  : 'border-[#2A2A2A] bg-transparent'
              }`}
            >
              <Text
                className={`text-xs ${chartMonths === months ? 'text-[#818CF8]' : 'text-neutral-500'}`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 pb-3 pt-4">
          <BarChart data={chartData} height={140} color="#818CF8" formatValue={chartFormatValue} />
        </View>

        {/* Categories & Mechanics */}
        {((game.categories?.length ?? 0) > 0 || (game.mechanics?.length ?? 0) > 0) && (
          <>
            <Text className="mb-2 mt-6 text-base font-semibold text-[#F9F9F9]">
              {Copy.gameDetail.categoriesTitle}
            </Text>
            <View className="flex-row flex-wrap rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
              {game.categories?.map((c) => (
                <MetaChip key={c} label={c} color="#818CF8" />
              ))}
              {game.mechanics?.map((m) => (
                <MetaChip key={m} label={m} color="#34D399" />
              ))}
            </View>
          </>
        )}

        {/* Expansions */}
        {game.kind !== 'expansion' && (
          <>
            <View className="mb-2 mt-6 flex-row items-center">
              <Text className="flex-1 text-base font-semibold text-[#F9F9F9]">
                {Copy.gameDetail.expansionsTitle}
              </Text>
              <Pressable
                onPress={() => setAddingExpansion(true)}
                accessibilityRole="button"
                accessibilityLabel={Copy.gameDetail.expansionsEditA11y}
                hitSlop={10}
                className="px-2 py-1"
              >
                <Text className="text-base text-[#A5B4FC]">✎</Text>
              </Pressable>
            </View>
            <View className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
              {expansionCount !== undefined && (
                <Text className="mb-2 text-sm text-neutral-400">
                  {Copy.gameDetail.expansionsAvailable(expansionCount)}
                </Text>
              )}
              {ownedExpansions.length === 0 ? (
                <Text className="text-sm text-neutral-500">
                  {Copy.gameDetail.expansionsOwnedNone}
                </Text>
              ) : (
                <>
                  <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {Copy.gameDetail.expansionsOwnedTitle}
                  </Text>
                  {ownedExpansions.map((exp, i) => (
                    <Pressable
                      key={exp.id}
                      onPress={() =>
                        router.push({ pathname: '/(app)/game', params: { id: exp.id } })
                      }
                      accessibilityRole="button"
                      className={`py-2.5 ${i < ownedExpansions.length - 1 ? 'border-b border-[#2A2A2A]' : ''}`}
                    >
                      <Text className="text-sm text-[#C7D2FE]">{exp.name}</Text>
                      {exp.yearPublished !== undefined && (
                        <Text className="mt-0.5 text-xs text-neutral-500">{exp.yearPublished}</Text>
                      )}
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          </>
        )}

        {/* Notes */}
        <Text className="mb-2 mt-6 text-base font-semibold text-[#F9F9F9]">
          {Copy.gameDetail.notesTitle}
        </Text>
        <TextInput
          className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
          placeholder={Copy.gameDetail.notesPlaceholder}
          placeholderTextColor="#525252"
          value={notes}
          onChangeText={setNotes}
          onBlur={handleNotesBlur}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        {/* Play history (Task 3 anchor + Task 4 filter panel) */}
        <View
          onLayout={(e) => {
            playHistoryY.current = e.nativeEvent.layout.y;
          }}
        >
          <View className="mb-2 mt-6 flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-[#F9F9F9]">
              {Copy.gameDetail.playsHistoryTitle}
            </Text>
            <Pressable
              onPress={() => setHistoryPanelOpen((v) => !v)}
              accessibilityRole="button"
              hitSlop={10}
              className="px-2 py-1"
            >
              <Text className="text-base text-[#A5B4FC]">⚙</Text>
            </Pressable>
          </View>

          {/* Inline filter/column panel (Task 4) */}
          {historyPanelOpen && (
            <View className="mb-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
              {/* Filter row */}
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Filter
              </Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'wins', label: 'Wins only' },
                    { key: 'losses', label: 'Losses only' },
                  ] as const
                ).map(({ key, label }) => (
                  <Pressable
                    key={key}
                    onPress={() => setHistoryFilter((prev) => ({ ...prev, filter: key }))}
                    className={`rounded-full border px-3 py-1 ${
                      historyFilter.filter === key
                        ? 'border-[#818CF8] bg-[#818CF8]/20'
                        : 'border-[#2A2A2A]'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        historyFilter.filter === key ? 'text-[#818CF8]' : 'text-neutral-400'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Column toggles */}
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Columns
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {COLUMN_TOGGLES.map(({ key, label }) => {
                  const active = historyFilter[key];
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setHistoryFilter((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
                        active ? 'border-[#818CF8] bg-[#818CF8]/20' : 'border-[#2A2A2A]'
                      }`}
                    >
                      <Text className={`text-xs ${active ? 'text-[#818CF8]' : 'text-neutral-400'}`}>
                        {active ? '✓ ' : ''}
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Play history rows */}
        {filteredGamePlays.length === 0 ? (
          <Text className="text-sm text-neutral-500">
            {gamePlays.length === 0 ? Copy.gameDetail.noPlaysYet : 'No plays match this filter.'}
          </Text>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A]">
            {filteredGamePlays.map((play, i) => {
              const date = new Date(play.playedAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const meta = [
                historyFilter.showPlayers
                  ? play.participants !== undefined
                    ? Copy.plays.playersShort(play.participants.length)
                    : play.playerCount !== undefined
                      ? Copy.plays.playersShort(play.playerCount)
                      : null
                  : null,
                historyFilter.showDuration && play.durationMinutes !== undefined
                  ? Copy.plays.durationShort(play.durationMinutes)
                  : null,
                historyFilter.showLocation ? (play.locationName ?? play.location ?? null) : null,
              ]
                .filter(Boolean)
                .join('  ·  ');
              return (
                <View
                  key={play.id}
                  className={`px-4 py-3 ${i < filteredGamePlays.length - 1 ? 'border-b border-[#2A2A2A]' : ''}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-[#F9F9F9]">{date}</Text>
                    {meta.length > 0 && <Text className="text-xs text-neutral-500">{meta}</Text>}
                  </View>
                  {historyFilter.showNote && play.note !== undefined && play.note.length > 0 && (
                    <Text className="mt-1 text-xs italic text-neutral-400">"{play.note}"</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Remove button */}
        <Pressable
          onPress={handleRemove}
          accessibilityRole="button"
          className="mt-8 rounded-xl border border-red-500/40 px-4 py-3.5"
        >
          <Text className="text-center text-sm font-semibold text-red-400">
            {Copy.gameDetail.remove}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Task 2 – pre-fill AddGameSheet with game name so expansion search starts immediately */}
      <AddGameSheet
        visible={addingExpansion}
        onClose={() => setAddingExpansion(false)}
        onAdd={handleAddExpansion}
        initialQuery={game.name}
      />
    </View>
  );
}
