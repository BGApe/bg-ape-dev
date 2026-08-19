import type React from 'react';
import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
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
  const [noteDraft, setNoteDraft] = useState(play.note ?? '');

  function handleNoteBlur() {
    const trimmed = noteDraft.trim();
    if (trimmed !== (play.note ?? '')) {
      onSaveNote(play.id, trimmed);
    }
  }

  const meta: string[] = [];
  if (play.location !== undefined) meta.push(play.location);
  if (play.playerCount !== undefined) meta.push(Copy.plays.playersShort(play.playerCount));
  if (play.durationMinutes !== undefined) meta.push(Copy.plays.durationShort(play.durationMinutes));

  return (
    <TouchableOpacity
      onLongPress={() => onDelete(play)}
      accessibilityRole="button"
      activeOpacity={1}
      className="mx-4 mb-2 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-2 text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
          {play.gameName}
        </Text>
        <Text className="text-xs text-neutral-500">{formatDate(play.playedAt)}</Text>
      </View>

      {meta.length > 0 && (
        <Text className="mt-1 text-xs text-neutral-400">{meta.join('  ·  ')}</Text>
      )}

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
