import type React from 'react';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Lightweight in-app month calendar — no native date-picker dependency.
 */
export function SimpleCalendar({ value, onChange }: Props): React.JSX.Element {
  const selected = parseDateStr(value) ?? new Date();
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first: JS getDay() Sun=0 → shift
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: { key: string; day: number | null; dateStr: string | null }[] = [];
    for (let i = 0; i < startPad; i++) {
      out.push({ key: `pad-${i}`, day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(new Date(year, month, d));
      out.push({ key: dateStr, day: d, dateStr });
    }
    return out;
  }, [cursor]);

  const title = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayStr = toDateStr(new Date());

  return (
    <View className="mt-2 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3">
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          hitSlop={8}
          className="px-2 py-1"
        >
          <Text className="text-base text-neutral-300">‹</Text>
        </Pressable>
        <Text className="text-sm font-semibold text-[#F9F9F9]">{title}</Text>
        <Pressable
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          hitSlop={8}
          className="px-2 py-1"
        >
          <Text className="text-base text-neutral-300">›</Text>
        </Pressable>
      </View>
      <View className="mb-1 flex-row">
        {WEEKDAYS.map((w) => (
          <View key={w} className="flex-1 items-center py-1">
            <Text className="text-[10px] text-neutral-500">{w}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((cell) => {
          if (cell.day === null || cell.dateStr === null) {
            return <View key={cell.key} className="h-9 w-[14.28%]" />;
          }
          const active = cell.dateStr === value;
          const isToday = cell.dateStr === todayStr;
          return (
            <Pressable
              key={cell.key}
              onPress={() => {
                if (cell.dateStr !== null) onChange(cell.dateStr);
              }}
              className="h-9 w-[14.28%] items-center justify-center"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  active ? 'bg-[#6D5DF6]' : isToday ? 'border border-[#6D5DF6]/50' : ''
                }`}
              >
                <Text
                  className={`text-sm ${active ? 'font-semibold text-white' : 'text-neutral-200'}`}
                >
                  {cell.day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
