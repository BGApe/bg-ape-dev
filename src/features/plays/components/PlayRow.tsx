import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { Routes } from '@/constants/routes';
import type { PlayId } from '@/types';

import type { Play } from '../types';

type Props = {
  play: Play;
  onSaveNote: (playId: PlayId, note: string) => void;
  onDelete: (play: Play) => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PlayRow({ play, onSaveNote, onDelete }: Props): React.JSX.Element {
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState(play.note ?? '');

  function handleNoteBlur() {
    const trimmed = noteDraft.trim();
    if (trimmed !== (play.note ?? '')) {
      onSaveNote(play.id, trimmed);
    }
  }

  // ── Participants ─────────────────────────────────────────────────────────────
  const participants = play.participants ?? [];
  const winners = participants.filter((p) => p.won);

  // ── Meta line (location · player count · duration) ───────────────────────────
  const meta: string[] = [];
  const locationDisplay = play.locationName ?? play.location;
  if (locationDisplay) meta.push(locationDisplay);

  if (participants.length > 0) {
    meta.push(Copy.plays.playersShort(participants.length));
  } else if (play.playerCount !== undefined) {
    meta.push(Copy.plays.playersShort(play.playerCount));
  }
  if (play.durationMinutes !== undefined) meta.push(Copy.plays.durationShort(play.durationMinutes));

  return (
    <TouchableOpacity
      onLongPress={() => onDelete(play)}
      accessibilityRole="button"
      activeOpacity={1}
      className="mx-4 mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
    >
      {/* Header row */}
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-2 text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
          {play.gameName}
        </Text>
        <Text className="text-xs text-neutral-500">{formatDate(play.playedAt)}</Text>
      </View>

      {/* Meta line */}
      {meta.length > 0 && (
        <Text className="mt-1 text-xs text-neutral-400">{meta.join('  ·  ')}</Text>
      )}

      {/* Participants with winner highlight */}
      {participants.length > 0 && (
        <View className="mt-2 flex-row flex-wrap gap-1">
          {participants.map((p) => (
            <TouchableOpacity
              key={p.playerId}
              onPress={() =>
                router.push({
                  pathname: Routes.player,
                  params: { id: p.playerId },
                } as unknown as Href)
              }
              accessibilityRole="button"
              className={`rounded-full border px-2.5 py-0.5 ${
                p.won ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-[#2A2A2A] bg-[#141414]'
              }`}
            >
              <Text className={`text-xs ${p.won ? 'text-yellow-300' : 'text-neutral-300'}`}>
                {p.won ? `★ ${p.name}` : p.name}
                {p.score !== undefined ? ` · ${p.score}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* No winner note (only when participants exist and none won) */}
      {participants.length > 0 && winners.length === 0 && (
        <Text className="mt-1 text-xs text-neutral-600">{Copy.plays.noWinner}</Text>
      )}

      {/* Inline-editable note */}
      <TextInput
        className="mt-2 rounded-lg bg-[#141414] px-3 py-2 text-sm text-[#E5E5E5]"
        placeholder={Copy.plays.noteRowPlaceholder}
        placeholderTextColor="#525252"
        value={noteDraft}
        onChangeText={setNoteDraft}
        onBlur={handleNoteBlur}
        multiline
      />
    </TouchableOpacity>
  );
}
