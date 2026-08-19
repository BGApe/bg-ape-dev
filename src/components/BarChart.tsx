import type React from 'react';
import { Text, View } from 'react-native';

export type BarDatum = {
  label: string;
  value: number;
};

type Props = {
  data: BarDatum[];
  /** Bar/accent colour. */
  color?: string;
  height?: number;
  /** Formats the value shown above the tallest bars (defaults to rounded number). */
  formatValue?: (value: number) => string;
};

/**
 * Minimal dependency-free bar chart built from plain Views (no native modules,
 * so it hot-reloads without a rebuild). Good enough for compact activity cards;
 * swap for a richer charting lib later if needed.
 */
export function BarChart({
  data,
  color = '#818CF8',
  height = 120,
  formatValue = (v) => String(Math.round(v)),
}: Props): React.JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={{ height }} className="flex-row items-end justify-between gap-1">
      {data.map((d) => {
        const ratio = d.value / max;
        const barHeight = Math.max(2, Math.round(ratio * (height - 24)));
        return (
          <View key={d.label} className="flex-1 items-center justify-end">
            {d.value > 0 && (
              <Text className="mb-1 text-[10px] text-neutral-400">{formatValue(d.value)}</Text>
            )}
            <View
              style={{ height: barHeight, backgroundColor: d.value > 0 ? color : '#2A2A2A' }}
              className="w-full rounded-t-md"
            />
            <Text className="mt-1 text-[10px] text-neutral-500" numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
