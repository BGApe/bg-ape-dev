import { useRouter } from 'expo-router';
import type React from 'react';
import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/BarChart';
import type { BarDatum } from '@/components/BarChart';
import { Copy } from '@/constants/copy';
import { REASON_EMOJI } from '@/features/chat/reasons';
import type { ChatReason } from '@/features/chat/types';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { usePlays } from '@/features/plays/hooks/usePlays';
import type { Play } from '@/features/plays/types';

const IWANT_ACTIONS: ChatReason[] = ['recommendation', 'setup', 'rules'];

/** Aggregate plays into 7 day-buckets relative to today. */
function buildWeekChart(plays: Play[]): BarDatum[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86_400_000;
    const count = plays.filter((p) => p.playedAt >= dayStart && p.playedAt < dayEnd).length;
    return {
      label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      value: count,
    };
  });
}

export default function HomeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: games = [] } = useCollection();
  const { data: plays = [] } = usePlays();

  const weekChart = useMemo(() => buildWeekChart(plays), [plays]);
  const hasActivity = weekChart.some((d) => d.value > 0);

  /** Sort collection games by number of logged plays, descending. */
  const topGames = useMemo(() => {
    const countByGameId = new Map<string, number>();
    for (const play of plays) {
      if (play.gameId) countByGameId.set(play.gameId, (countByGameId.get(play.gameId) ?? 0) + 1);
    }
    return [...games]
      .sort((a, b) => (countByGameId.get(b.id) ?? 0) - (countByGameId.get(a.id) ?? 0))
      .slice(0, 5);
  }, [games, plays]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0F0F0F' }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
      }}
    >
      <Text className="text-2xl font-bold text-[#F9F9F9]">{Copy.home.greeting}</Text>
      <Text className="mb-5 mt-1 text-sm text-neutral-400">{Copy.home.subtitle}</Text>

      <TouchableOpacity
        onPress={() => router.push({ pathname: '/(app)/intent', params: { reason: 'general' } })}
        accessibilityRole="button"
        className="mb-6 rounded-2xl border border-[#6D5DF6]/50 bg-[#6D5DF6]/15 px-4 py-4"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">✨</Text>
          <Text className="text-base font-semibold text-[#F9F9F9]">{Copy.home.askAnything}</Text>
        </View>
        <Text className="mt-1 text-xs text-neutral-400">{Copy.home.askHint}</Text>
      </TouchableOpacity>

      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {Copy.home.iWant}
      </Text>
      <View className="mb-6 gap-2">
        {IWANT_ACTIONS.map((reason) => (
          <TouchableOpacity
            key={reason}
            onPress={() => router.push({ pathname: '/(app)/intent', params: { reason } })}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
          >
            <Text className="text-2xl">{REASON_EMOJI[reason]}</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-[#F9F9F9]">
                {Copy.chat.reasons[reason]}
              </Text>
              <Text className="mt-0.5 text-xs text-neutral-400">
                {Copy.home.actionHints[reason]}
              </Text>
            </View>
            <Text className="text-neutral-600">›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity chart — tapping opens the full plays history */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/plays')}
        accessibilityRole="button"
        className="mb-6 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 pb-3 pt-4"
      >
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-[#F9F9F9]">{Copy.home.activityTitle}</Text>
          <Text className="text-xs text-[#818CF8]">{Copy.home.seeAll}</Text>
        </View>
        <BarChart data={weekChart} height={110} />
        {!hasActivity && (
          <Text className="mt-2 text-xs text-neutral-500">{Copy.home.noActivity}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(app)/plays')}
        accessibilityRole="button"
        className="mb-6 items-center rounded-2xl border border-[#6D5DF6]/50 bg-[#6D5DF6]/15 py-3.5"
      >
        <Text className="text-sm font-semibold text-[#F9F9F9]">{Copy.home.logPlay}</Text>
      </TouchableOpacity>

      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-[#F9F9F9]">{Copy.home.topGamesTitle}</Text>
        <TouchableOpacity
          onPress={() => router.navigate('/(app)/collection')}
          accessibilityRole="button"
        >
          <Text className="text-xs text-[#818CF8]">{Copy.home.seeAll}</Text>
        </TouchableOpacity>
      </View>

      {topGames.length === 0 ? (
        <View className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-5">
          <Text className="text-sm text-neutral-400">{Copy.home.noGames}</Text>
        </View>
      ) : (
        <View className="gap-2">
          {topGames.map((game, i) => {
            const playCount = plays.filter((p) => p.gameId === game.id).length;
            return (
              <TouchableOpacity
                key={game.id}
                onPress={() => router.push({ pathname: '/(app)/game', params: { id: game.id } })}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
              >
                <Text className="w-5 text-center text-sm font-bold text-neutral-500">{i + 1}</Text>
                <Text className="flex-1 text-base text-[#F9F9F9]" numberOfLines={1}>
                  {game.name}
                </Text>
                {playCount > 0 && <Text className="text-xs text-neutral-500">{playCount}×</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
