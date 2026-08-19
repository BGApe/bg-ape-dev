import type React from 'react';
import { Text, View } from 'react-native';

type Props = {
  label: string;
  /** Hex accent colour for the text/border. Defaults to neutral (#525252). */
  color?: string;
};

/**
 * Tiny pill badge used for BGG metadata (weight, rating, mechanics, categories).
 * Inline-styles for the dynamic colour; className for layout/spacing.
 */
export function MetaChip({ label, color = '#525252' }: Props): React.JSX.Element {
  return (
    <View
      style={{ borderColor: `${color}50`, backgroundColor: `${color}18` }}
      className="mr-1.5 mb-1 rounded-full border px-2.5 py-0.5"
    >
      <Text style={{ color }} className="text-xs">
        {label}
      </Text>
    </View>
  );
}

/** Returns a colour for a BGG weight (complexity) value 1–5. */
export function weightColor(w: number): string {
  if (w < 2.5) return '#34D399'; // easy — green
  if (w < 3.5) return '#FBBF24'; // medium — amber
  return '#F97316'; // heavy — orange
}

/** Returns a colour for a BGG average rating 1–10. */
export function ratingColor(r: number): string {
  if (r >= 7.5) return '#34D399'; // excellent — green
  if (r >= 6.5) return '#FBBF24'; // good — amber
  return '#818CF8'; // average — indigo
}
