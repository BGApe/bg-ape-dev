import type React from 'react';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Copy } from '@/constants/copy';
import { useCollection } from '@/features/collection/hooks/useCollection';
import type { GameId } from '@/types';

import { LogPlaySchema } from '../schemas';
import type { NewPlay } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (play: NewPlay) => void;
};

/** Local YYYY-MM-DD for a Date. */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD to local-noon epoch ms, or null if invalid. */
function parseDateStr(s: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

export function LogPlaySheet({ visible, onClose, onSubmit }: Props): React.JSX.Element {
  const { data: games = [] } = useCollection();

  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [dateStr, setDateStr] = useState(toDateStr(new Date()));
  const [location, setLocation] = useState('');
  const [players, setPlayers] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setGameName('');
    setGameId(null);
    setDateStr(toDateStr(new Date()));
    setLocation('');
    setPlayers('');
    setDuration('');
    setNote('');
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSave() {
    const playedAt = parseDateStr(dateStr);
    if (playedAt === null) {
      setError(Copy.plays.invalidDate);
      return;
    }

    const input: NewPlay = { gameName: gameName.trim(), playedAt };
    if (gameId !== null) input.gameId = gameId;

    const loc = location.trim();
    if (loc.length > 0) input.location = loc;

    const p = Number.parseInt(players, 10);
    if (!Number.isNaN(p) && p > 0) input.playerCount = p;

    const d = Number.parseInt(duration, 10);
    if (!Number.isNaN(d) && d > 0) input.durationMinutes = d;

    const n = note.trim();
    if (n.length > 0) input.note = n;

    const parsed = LogPlaySchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? Copy.errors.generic);
      return;
    }

    onSubmit(input);
    resetForm();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={handleClose}>
        <Pressable
          className="max-h-[88%] rounded-t-3xl border-t border-[#2A2A2A] bg-[#141414]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-[#3A3A3A]" />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
            <Text className="mb-4 text-lg font-bold text-[#F9F9F9]">{Copy.plays.formTitle}</Text>

            {/* Game */}
            <Text className="mb-1 text-sm text-neutral-400">{Copy.plays.gameLabel}</Text>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder={Copy.plays.gamePlaceholder}
              placeholderTextColor="#525252"
              value={gameName}
              onChangeText={(t) => {
                setGameName(t);
                setGameId(null);
              }}
            />
            {games.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  {games.map((game) => {
                    const active = game.id === gameId;
                    return (
                      <TouchableOpacity
                        key={game.id}
                        onPress={() => {
                          setGameName(game.name);
                          setGameId(game.id);
                        }}
                        accessibilityRole="button"
                        className={`rounded-full border px-3 py-1.5 ${
                          active
                            ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
                            : 'border-[#2A2A2A] bg-[#1A1A1A]'
                        }`}
                      >
                        <Text className="text-xs text-[#F9F9F9]">{game.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Date */}
            <Text className="mb-1 mt-4 text-sm text-neutral-400">{Copy.plays.dateLabel}</Text>
            <View className="mb-2 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setDateStr(daysAgo(0))}
                accessibilityRole="button"
                className={`rounded-full border px-3 py-1.5 ${
                  dateStr === daysAgo(0)
                    ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
                    : 'border-[#2A2A2A] bg-[#1A1A1A]'
                }`}
              >
                <Text className="text-xs text-[#F9F9F9]">{Copy.plays.today}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDateStr(daysAgo(1))}
                accessibilityRole="button"
                className={`rounded-full border px-3 py-1.5 ${
                  dateStr === daysAgo(1)
                    ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
                    : 'border-[#2A2A2A] bg-[#1A1A1A]'
                }`}
              >
                <Text className="text-xs text-[#F9F9F9]">{Copy.plays.yesterday}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder={Copy.plays.datePlaceholder}
              placeholderTextColor="#525252"
              value={dateStr}
              onChangeText={setDateStr}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />

            {/* Location */}
            <Text className="mb-1 mt-4 text-sm text-neutral-400">{Copy.plays.locationLabel}</Text>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder={Copy.plays.locationPlaceholder}
              placeholderTextColor="#525252"
              value={location}
              onChangeText={setLocation}
            />

            {/* Players + Duration */}
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-sm text-neutral-400">{Copy.plays.playersLabel}</Text>
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="0"
                  placeholderTextColor="#525252"
                  value={players}
                  onChangeText={setPlayers}
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-sm text-neutral-400">{Copy.plays.durationLabel}</Text>
                <TextInput
                  className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
                  placeholder="0"
                  placeholderTextColor="#525252"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Note */}
            <Text className="mb-1 mt-4 text-sm text-neutral-400">{Copy.plays.noteLabel}</Text>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder={Copy.plays.notePlaceholder}
              placeholderTextColor="#525252"
              value={note}
              onChangeText={setNote}
              multiline
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />

            {error !== null && <Text className="mt-3 text-xs text-red-400">{error}</Text>}

            <TouchableOpacity
              onPress={handleSave}
              accessibilityRole="button"
              className="mt-5 items-center rounded-2xl bg-[#6D5DF6] py-4"
            >
              <Text className="text-base font-semibold text-white">{Copy.plays.save}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              className="mt-2 items-center py-3"
            >
              <Text className="text-sm text-neutral-400">{Copy.plays.cancel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
