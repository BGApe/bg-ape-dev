import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { BarChart } from '@/components/BarChart';
import type { BarDatum } from '@/components/BarChart';
import { Copy } from '@/constants/copy';
import { Routes } from '@/constants/routes';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { useLocations } from '@/features/locations/hooks/useLocations';
import { usePlayers } from '@/features/players/hooks/usePlayers';
import { usePlays } from '@/features/plays/hooks/usePlays';
import type { Play } from '@/features/plays/types';
import type { LocationId, PlayerId } from '@/types';

type Metric = 'plays' | 'group';
type Range = 'day' | 'week' | 'month';

// ─── Chart aggregation ────────────────────────────────────────────────────────

function playsValue(ps: Play[]): number {
  return ps.length;
}

function groupValue(ps: Play[]): number {
  const counts = ps
    .map((p) => (p.participants !== undefined ? p.participants.length : (p.playerCount ?? 0)))
    .filter((n) => n > 0);
  if (counts.length === 0) return 0;
  return Math.round(counts.reduce((s, n) => s + n, 0) / counts.length);
}

function buildDayBuckets(plays: Play[], metric: Metric): BarDatum[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const bucket = plays.filter((p) => p.playedAt >= start && p.playedAt < start + 86_400_000);
    return {
      label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      value: metric === 'plays' ? playsValue(bucket) : groupValue(bucket),
    };
  });
}

function buildWeekBuckets(plays: Play[], metric: Metric): BarDatum[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() - 7 * (5 - i));
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end = start + 7 * 86_400_000;
    const bucket = plays.filter((p) => p.playedAt >= start && p.playedAt < end);
    return {
      label: `W${i + 1}`,
      value: metric === 'plays' ? playsValue(bucket) : groupValue(bucket),
    };
  });
}

function buildMonthBuckets(plays: Play[], metric: Metric): BarDatum[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(now.getMonth() - (5 - i));
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const bucket = plays.filter((p) => p.playedAt >= start && p.playedAt < end);
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      value: metric === 'plays' ? playsValue(bucket) : groupValue(bucket),
    };
  });
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}): React.JSX.Element {
  return (
    <View className="flex-row gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            className={`rounded-full border px-3 py-1.5 ${
              active ? 'border-[#6D5DF6] bg-[#6D5DF6]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'
            }`}
          >
            <Text className={`text-xs ${active ? 'text-[#F9F9F9]' : 'text-neutral-400'}`}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-1 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3">
      <Text className="text-xs uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="mt-1 text-xl font-bold text-[#F9F9F9]">{value}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`rounded-full border px-3 py-1.5 ${
        disabled
          ? 'border-[#2A2A2A] bg-[#1A1A1A] opacity-40'
          : active
            ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
            : 'border-[#2A2A2A] bg-[#1A1A1A]'
      }`}
    >
      <Text className={`text-xs ${active ? 'text-[#F9F9F9]' : 'text-neutral-400'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View className="mb-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">{children}</View>
      </ScrollView>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: plays = [] } = usePlays();
  const { data: games = [] } = useCollection();
  const { data: players = [] } = usePlayers();
  const { data: locations = [] } = useLocations();

  const [metric, setMetric] = useState<Metric>('plays');
  const [range, setRange] = useState<Range>('day');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<PlayerId>>(new Set());
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<LocationId>>(new Set());

  // ── Derive available filter options from plays data ───────────────────────────
  const activePlayerIds = useMemo(() => {
    const ids = new Set<PlayerId>();
    for (const play of plays) {
      for (const p of play.participants ?? []) ids.add(p.playerId);
    }
    return ids;
  }, [plays]);

  const activeLocationIds = useMemo(() => {
    const ids = new Set<LocationId>();
    for (const play of plays) {
      if (play.locationId) ids.add(play.locationId);
    }
    return ids;
  }, [plays]);

  // Game metadata available in plays (for skeleton visibility decision)
  const hasAnyMetadata = useMemo(
    () =>
      plays.some((p) => (p.gameCategories?.length ?? 0) > 0 || (p.gameMechanics?.length ?? 0) > 0),
    [plays],
  );

  // ── Filter plays ──────────────────────────────────────────────────────────────
  const filteredPlays = useMemo(() => {
    let result = plays;
    if (selectedPlayerIds.size > 0) {
      result = result.filter((p) =>
        p.participants?.some((pt) => selectedPlayerIds.has(pt.playerId)),
      );
    }
    if (selectedLocationIds.size > 0) {
      result = result.filter(
        (p) => p.locationId !== undefined && selectedLocationIds.has(p.locationId),
      );
    }
    return result;
  }, [plays, selectedPlayerIds, selectedLocationIds]);

  // ── Chart ─────────────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (range === 'day') return buildDayBuckets(filteredPlays, metric);
    if (range === 'week') return buildWeekBuckets(filteredPlays, metric);
    return buildMonthBuckets(filteredPlays, metric);
  }, [filteredPlays, metric, range]);

  const hasData = chartData.some((d) => d.value > 0);

  // ── Summary stats (from filteredPlays) ────────────────────────────────────────
  const totalPlays = filteredPlays.length;

  const avgPlayers = useMemo(() => {
    const counts = filteredPlays
      .map((p) => (p.participants !== undefined ? p.participants.length : (p.playerCount ?? 0)))
      .filter((n) => n > 0);
    if (counts.length === 0) return '—';
    return (counts.reduce((s, n) => s + n, 0) / counts.length).toFixed(1);
  }, [filteredPlays]);

  const mostPlayedGame = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const p of filteredPlays) {
      const key = p.gameId ?? p.gameName;
      const name = p.gameId
        ? (games.find((g) => g.id === p.gameId)?.name ?? p.gameName)
        : p.gameName;
      const prev = counts.get(key);
      counts.set(key, { name, count: (prev?.count ?? 0) + 1 });
    }
    if (counts.size === 0) return '—';
    return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.name ?? '—';
  }, [filteredPlays, games]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const playsThisMonth = filteredPlays.filter((p) => p.playedAt >= monthStart).length;

  // ── Filter toggle helpers ─────────────────────────────────────────────────────
  function togglePlayer(id: PlayerId) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleLocation(id: LocationId) {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filtersActive = selectedPlayerIds.size > 0 || selectedLocationIds.size > 0;

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
        <Text className="flex-1 text-lg font-bold text-[#F9F9F9]">{Copy.stats.title}</Text>
        {filtersActive && (
          <TouchableOpacity
            onPress={() => {
              setSelectedPlayerIds(new Set());
              setSelectedLocationIds(new Set());
            }}
            accessibilityRole="button"
            className="rounded-full border border-[#6D5DF6] px-3 py-1"
          >
            <Text className="text-xs text-[#6D5DF6]">Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        {/* ── Player filter ── */}
        {activePlayerIds.size > 0 && (
          <FilterSection title={Copy.players.filterLabel}>
            {players
              .filter((p) => activePlayerIds.has(p.id))
              .map((p) => (
                <FilterChip
                  key={p.id}
                  label={p.name}
                  active={selectedPlayerIds.has(p.id)}
                  onPress={() => togglePlayer(p.id)}
                />
              ))}
          </FilterSection>
        )}

        {/* ── Location filter ── */}
        {activeLocationIds.size > 0 && (
          <FilterSection title={Copy.locations.filterLabel}>
            {locations
              .filter((l) => activeLocationIds.has(l.id))
              .map((l) => (
                <FilterChip
                  key={l.id}
                  label={l.name}
                  active={selectedLocationIds.has(l.id)}
                  onPress={() => toggleLocation(l.id)}
                />
              ))}
          </FilterSection>
        )}

        {/* ── Game metadata filter skeleton ── */}
        <FilterSection title="Game type">
          {hasAnyMetadata ? (
            <Text className="text-xs text-neutral-400">
              Filters will appear here once games are enriched via BGG.
            </Text>
          ) : (
            <>
              {['Euro', 'Strategy', 'Cooperative', 'Card game', 'Party'].map((label) => (
                <FilterChip key={label} label={label} active={false} onPress={() => {}} disabled />
              ))}
            </>
          )}
        </FilterSection>

        {/* ── Summary cards ── */}
        <View className="mb-4 flex-row gap-2">
          <StatCard label="Total plays" value={String(totalPlays)} />
          <StatCard label="This month" value={String(playsThisMonth)} />
        </View>
        <View className="mb-5 flex-row gap-2">
          <StatCard label="Avg players" value={avgPlayers} />
          <StatCard label="Most played" value={mostPlayedGame} />
        </View>

        {/* ── Metric toggle ── */}
        <View className="mb-3">
          <Toggle
            options={[
              { id: 'plays', label: Copy.stats.metricPlays },
              { id: 'group', label: Copy.stats.metricGroup },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </View>

        {/* ── Range toggle ── */}
        <View className="mb-4">
          <Toggle
            options={[
              { id: 'day', label: Copy.stats.rangeDay },
              { id: 'week', label: Copy.stats.rangeWeek },
              { id: 'month', label: Copy.stats.rangeMonth },
            ]}
            value={range}
            onChange={setRange}
          />
        </View>

        <View className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 pb-3 pt-4">
          <BarChart
            data={chartData}
            height={180}
            color={metric === 'plays' ? '#818CF8' : '#34D399'}
          />
        </View>

        {!hasData && (
          <Text className="mt-4 text-center text-sm text-neutral-500">{Copy.stats.empty}</Text>
        )}

        {/* ── Players quick list ── (tap to go to per-player screen) */}
        {players.filter((p) => activePlayerIds.has(p.id)).length > 0 && (
          <View className="mt-6">
            <Text className="mb-2 text-sm font-semibold text-neutral-300">
              {Copy.players.filterLabel}
            </Text>
            {players
              .filter((p) => activePlayerIds.has(p.id))
              .map((player) => {
                const playerPlays = plays.filter((play) =>
                  play.participants?.some((pt) => pt.playerId === player.id),
                );
                const wins = playerPlays.filter((play) =>
                  play.participants?.some((pt) => pt.playerId === player.id && pt.won),
                ).length;
                const winRate =
                  playerPlays.length > 0 ? Math.round((wins / playerPlays.length) * 100) : 0;
                return (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() =>
                      router.push({
                        pathname: Routes.player,
                        params: { id: player.id },
                      } as unknown as Href)
                    }
                    accessibilityRole="button"
                    className="mb-2 flex-row items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
                  >
                    <Text className="text-sm font-medium text-[#F9F9F9]">{player.name}</Text>
                    <View className="flex-row gap-3">
                      <Text className="text-xs text-neutral-400">{playerPlays.length} plays</Text>
                      <Text className="text-xs text-yellow-400">{winRate}% wins</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
