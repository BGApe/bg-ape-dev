import { useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { Copy } from '@/constants/copy';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { usePlayers } from '@/features/players/hooks/usePlayers';
import { usePlays } from '@/features/plays/hooks/usePlays';
import type { PlayerId } from '@/types';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-1 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3">
      <Text className="text-xs uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="mt-1 text-xl font-bold text-[#F9F9F9]">{value}</Text>
    </View>
  );
}

export default function PlayerScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: players = [] } = usePlayers();
  const { data: plays = [] } = usePlays();
  const { data: games = [] } = useCollection();

  const player = players.find((p) => p.id === (id as PlayerId));

  // ── Plays this player participated in ────────────────────────────────────────
  const playerPlays = useMemo(
    () => plays.filter((play) => play.participants?.some((pt) => pt.playerId === (id as PlayerId))),
    [plays, id],
  );

  // ── Per-play participant data ─────────────────────────────────────────────────
  const withParticipant = useMemo(
    () =>
      playerPlays.map((play) => ({
        play,
        participant: play.participants?.find((pt) => pt.playerId === (id as PlayerId)),
      })),
    [playerPlays, id],
  );

  // ── Aggregate stats ───────────────────────────────────────────────────────────
  const totalPlays = playerPlays.length;
  const wins = withParticipant.filter((x) => x.participant?.won).length;
  const winRate = totalPlays > 0 ? Math.round((wins / totalPlays) * 100) : 0;

  const scoresWithValue = withParticipant
    .map((x) => x.participant?.score)
    .filter((s): s is number => s !== undefined);
  const avgScore =
    scoresWithValue.length > 0
      ? (scoresWithValue.reduce((a, b) => a + b, 0) / scoresWithValue.length).toFixed(1)
      : null;

  const mostPlayedGame = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const { play } of withParticipant) {
      const key = play.gameId ?? play.gameName;
      const name = play.gameId
        ? (games.find((g) => g.id === play.gameId)?.name ?? play.gameName)
        : play.gameName;
      const prev = counts.get(key);
      counts.set(key, { name, count: (prev?.count ?? 0) + 1 });
    }
    if (counts.size === 0) return null;
    return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.name ?? null;
  }, [withParticipant, games]);

  if (!player) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top + 4 }}>
        <AskBar />
        <TouchableOpacity onPress={() => router.back()} className="px-5 py-3">
          <Text className="text-neutral-400">‹ Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-500">Player not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top + 4 }}>
      <AskBar />

      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-[#F9F9F9]">{player.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {/* ── Summary cards ── */}
        <View className="mb-3 flex-row gap-2">
          <StatCard label={Copy.players.totalPlays} value={String(totalPlays)} />
          <StatCard label={Copy.players.wins} value={String(wins)} />
        </View>
        <View className="mb-5 flex-row gap-2">
          <StatCard label={Copy.players.winRate} value={totalPlays > 0 ? `${winRate}%` : '—'} />
          <StatCard label={Copy.players.avgScore} value={avgScore ?? '—'} />
        </View>

        {/* ── Most played game ── */}
        {mostPlayedGame && (
          <View className="mb-5 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
            <Text className="text-xs uppercase tracking-wide text-neutral-500">
              {Copy.players.mostPlayed}
            </Text>
            <Text className="mt-1 text-base font-semibold text-[#F9F9F9]">{mostPlayedGame}</Text>
          </View>
        )}

        {/* ── Play history ── */}
        <Text className="mb-2 text-sm font-semibold text-neutral-300">
          {Copy.players.recentPlays}
        </Text>

        {withParticipant.length === 0 ? (
          <Text className="text-sm text-neutral-500">{Copy.players.noPlays}</Text>
        ) : (
          withParticipant.slice(0, 20).map(({ play, participant }) => (
            <View
              key={play.id}
              className="mb-2 flex-row items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-medium text-[#F9F9F9]" numberOfLines={1}>
                  {play.gameName}
                </Text>
                <Text className="text-xs text-neutral-500">{formatDate(play.playedAt)}</Text>
              </View>
              <View className="items-end gap-0.5">
                {participant?.won && (
                  <Text className="text-xs font-semibold text-yellow-400">★ Won</Text>
                )}
                {participant?.score !== undefined && (
                  <Text className="text-xs text-neutral-400">{participant.score} pts</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
