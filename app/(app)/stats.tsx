import { useRouter } from 'expo-router';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { BarChart } from '@/components/BarChart';
import type { BarDatum } from '@/components/BarChart';
import { Copy } from '@/constants/copy';

type Metric = 'plays' | 'group';
type Range = 'day' | 'week' | 'month';

/** Builds empty buckets for the selected range (real values arrive with the plays model). */
function emptyBuckets(range: Range): BarDatum[] {
  const now = new Date();
  if (range === 'day') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return { label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), value: 0 };
    });
  }
  if (range === 'week') {
    return Array.from({ length: 6 }, (_, i) => ({ label: `W${i + 1}`, value: 0 }));
  }
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(now.getMonth() - (5 - i));
    return { label: d.toLocaleDateString(undefined, { month: 'short' }), value: 0 };
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

export default function StatsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>('plays');
  const [range, setRange] = useState<Range>('day');

  const data = useMemo(() => emptyBuckets(range), [range]);
  const hasData = data.some((d) => d.value > 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}>
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

      <AskBar />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <View className="mb-3">
          <Text className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            {Copy.stats.metricPlays} / {Copy.stats.metricGroup}
          </Text>
          <Toggle
            options={[
              { id: 'plays', label: Copy.stats.metricPlays },
              { id: 'group', label: Copy.stats.metricGroup },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </View>

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
          <BarChart data={data} height={180} color={metric === 'plays' ? '#818CF8' : '#34D399'} />
        </View>

        {!hasData && (
          <Text className="mt-4 text-center text-sm text-neutral-500">{Copy.stats.empty}</Text>
        )}
      </ScrollView>
    </View>
  );
}
