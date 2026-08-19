import { useRouter } from 'expo-router';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { BarChart } from '@/components/BarChart';
import type { BarDatum } from '@/components/BarChart';
import { Copy } from '@/constants/copy';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { usePlays } from '@/features/plays/hooks/usePlays';
import type { Play } from '@/features/plays/types';

type Metric = 'plays' | 'group';
type Range = 'day' | 'week' | 'month';

function playsValue(ps: Play[]): number {
  return ps.length;
}

function groupValue(ps: Play[]): number {
  const withCount = ps.filter((p) => p.playerCount !== undefined);
  if (withCount.length === 0) return 0;
  return Math.round(withCount.reduce((s, p) => s + (p.playerCount ?? 0), 0) / withCount.length);
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
    const weekNum = Math.ceil(i + 1);
    return {
      label: `W${weekNum}`,
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

export default function StatsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: plays = [] } = usePlays();
  const { data: games = [] } = useCollection();
  const [metric, setMetric] = useState<Metric>('plays');
  const [range, setRange] = useState<Range>('day');

  const chartData = useMemo(() => {
    if (range === 'day') return buildDayBuckets(plays, metric);
    if (range === 'week') return buildWeekBuckets(plays, metric);
    return buildMonthBuckets(plays, metric);
  }, [plays, metric, range]);

  const hasData = chartData.some((d) => d.value > 0);

  /** Summary stats */
  const totalPlays = plays.length;
  const avgPlayers = useMemo(() => {
    const withCount = plays.filter((p) => p.playerCount !== undefined);
    if (withCount.length === 0) return '—';
    return (withCount.reduce((s, p) => s + (p.playerCount ?? 0), 0) / withCount.length).toFixed(1);
  }, [plays]);

  const mostPlayedGame = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const p of plays) {
      const key = p.gameId ?? p.gameName;
      const prev = counts.get(key);
      const name = p.gameId
        ? (games.find((g) => g.id === p.gameId)?.name ?? p.gameName)
        : p.gameName;
      counts.set(key, { name, count: (prev?.count ?? 0) + 1 });
    }
    if (counts.size === 0) return '—';
    return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.name ?? '—';
  }, [plays, games]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const playsThisMonth = plays.filter((p) => p.playedAt >= monthStart).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top + 4 }}>
      <AskBar />

      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel={Copy.tabs.home}
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-[#F9F9F9]">{Copy.stats.title}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        {/* Summary cards */}
        <View className="mb-4 flex-row gap-2">
          <StatCard label="Total plays" value={String(totalPlays)} />
          <StatCard label="This month" value={String(playsThisMonth)} />
        </View>
        <View className="mb-5 flex-row gap-2">
          <StatCard label="Avg players" value={avgPlayers} />
          <StatCard label="Most played" value={mostPlayedGame} />
        </View>

        {/* Metric toggle */}
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

        {/* Range toggle */}
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
      </ScrollView>
    </View>
  );
}
