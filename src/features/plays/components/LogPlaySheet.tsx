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
import { useLocations } from '@/features/locations/hooks/useLocations';
import { usePlayers } from '@/features/players/hooks/usePlayers';
import type { GameId, LocationId, PlayerId } from '@/types';

import { LogPlaySchema } from '../schemas';
import type { NewPlay, NewPlayParticipant } from '../types';

// ─── Local draft types ────────────────────────────────────────────────────────

type ParticipantDraft = {
  key: string;
  playerId: PlayerId | null;
  name: string;
  score: string;
  won: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  return <Text className="mb-1 mt-4 text-sm text-neutral-400">{children}</Text>;
}

function ChipRow({
  items,
  selectedId,
  onSelect,
}: {
  items: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string, label: string) => void;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
      <View className="flex-row gap-2">
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onSelect(item.id, item.label)}
              accessibilityRole="button"
              className={`rounded-full border px-3 py-1.5 ${
                active ? 'border-[#6D5DF6] bg-[#6D5DF6]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <Text className="text-xs text-[#F9F9F9]">{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── ParticipantRow ───────────────────────────────────────────────────────────

function ParticipantRow({
  draft,
  players,
  onChange,
  onRemove,
}: {
  draft: ParticipantDraft;
  players: { id: PlayerId; name: string }[];
  onChange: (updated: ParticipantDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const [nameFocused, setNameFocused] = useState(false);
  const suggestions = nameFocused
    ? players.filter(
        (p) => p.name.toLowerCase().includes(draft.name.toLowerCase()) && draft.name.length > 0,
      )
    : [];

  return (
    <View className="mb-2 rounded-xl border border-[#2A2A2A] bg-[#1F1F1F] px-3 py-2">
      {/* Name row */}
      <View className="flex-row items-center gap-2">
        <TextInput
          className="flex-1 text-sm text-[#F9F9F9]"
          placeholder={Copy.plays.participantNamePlaceholder}
          placeholderTextColor="#525252"
          value={draft.name}
          onChangeText={(t) => onChange({ ...draft, name: t, playerId: null })}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setTimeout(() => setNameFocused(false), 150)}
        />
        <TouchableOpacity
          onPress={() => onChange({ ...draft, won: !draft.won })}
          accessibilityRole="button"
          className={`rounded-full border px-2 py-1 ${
            draft.won ? 'border-yellow-500 bg-yellow-500/15' : 'border-[#3A3A3A] bg-transparent'
          }`}
        >
          <Text className={`text-xs ${draft.won ? 'text-yellow-400' : 'text-neutral-500'}`}>
            {Copy.plays.wonLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove} accessibilityRole="button" className="px-1">
          <Text className="text-base text-neutral-600">✕</Text>
        </TouchableOpacity>
      </View>

      {/* Score */}
      <View className="mt-1.5 flex-row items-center gap-2">
        <Text className="text-xs text-neutral-500">{Copy.plays.scoreLabel}</Text>
        <TextInput
          className="w-16 rounded-lg bg-[#141414] px-2 py-1 text-xs text-[#F9F9F9]"
          placeholder={Copy.plays.scorePlaceholder}
          placeholderTextColor="#525252"
          value={draft.score}
          onChangeText={(t) => onChange({ ...draft, score: t })}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row gap-2">
            {suggestions.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => onChange({ ...draft, playerId: p.id, name: p.name })}
                accessibilityRole="button"
                className="rounded-full border border-[#6D5DF6] bg-[#6D5DF6]/15 px-3 py-1"
              >
                <Text className="text-xs text-[#F9F9F9]">{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (play: NewPlay) => void;
};

export function LogPlaySheet({ visible, onClose, onSubmit }: Props): React.JSX.Element {
  const { data: games = [] } = useCollection();
  const { data: players = [] } = usePlayers();
  const { data: locations = [] } = useLocations();

  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [dateStr, setDateStr] = useState(toDateStr(new Date()));
  const [locationText, setLocationText] = useState('');
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [participantDrafts, setParticipantDrafts] = useState<ParticipantDraft[]>([]);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  let draftCounter = 0;

  function resetForm() {
    setGameName('');
    setGameId(null);
    setDateStr(toDateStr(new Date()));
    setLocationText('');
    setLocationId(null);
    setParticipantDrafts([]);
    setDuration('');
    setNote('');
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function addParticipant() {
    draftCounter += 1;
    setParticipantDrafts((prev) => [
      ...prev,
      { key: `${Date.now()}-${draftCounter}`, playerId: null, name: '', score: '', won: false },
    ]);
  }

  function updateParticipant(key: string, updated: ParticipantDraft) {
    setParticipantDrafts((prev) => prev.map((d) => (d.key === key ? updated : d)));
  }

  function removeParticipant(key: string) {
    setParticipantDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function handleSave() {
    const playedAt = parseDateStr(dateStr);
    if (playedAt === null) {
      setError(Copy.plays.invalidDate);
      return;
    }

    const validated = LogPlaySchema.safeParse({
      gameName: gameName.trim(),
      playedAt,
      locationName: locationText.trim() || undefined,
      durationMinutes: duration ? Number.parseInt(duration, 10) : undefined,
      note: note.trim() || undefined,
    });

    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? Copy.errors.generic);
      return;
    }

    const play: NewPlay = { gameName: gameName.trim(), playedAt };
    if (gameId !== null) play.gameId = gameId;

    if (locationId !== null) {
      play.locationId = locationId;
      play.locationName = locationText.trim();
    } else if (locationText.trim().length > 0) {
      play.locationName = locationText.trim();
    }

    const validParticipants = participantDrafts.filter((d) => d.name.trim().length > 0);
    if (validParticipants.length > 0) {
      play.participants = validParticipants.map((d): NewPlayParticipant => {
        const p: NewPlayParticipant = { name: d.name.trim(), won: d.won };
        if (d.playerId !== null) p.playerId = d.playerId;
        const scoreNum = d.score ? Number.parseInt(d.score, 10) : NaN;
        if (!Number.isNaN(scoreNum) && scoreNum >= 0) p.score = scoreNum;
        return p;
      });
    }

    const d = Number.parseInt(duration, 10);
    if (!Number.isNaN(d) && d > 0) play.durationMinutes = d;

    const n = note.trim();
    if (n.length > 0) play.note = n;

    onSubmit(play);
    resetForm();
  }

  const locationItems = locations.map((l) => ({ id: l.id, label: l.name }));
  const playerItems = players.map((p) => ({ id: p.id, label: p.name }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={handleClose}>
        <Pressable
          className="max-h-[90%] rounded-t-3xl border-t border-[#2A2A2A] bg-[#141414]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-full bg-[#3A3A3A]" />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="mb-4 text-lg font-bold text-[#F9F9F9]">{Copy.plays.formTitle}</Text>

            {/* ── Game ── */}
            <SectionLabel>{Copy.plays.gameLabel}</SectionLabel>
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
              <ChipRow
                items={games.map((g) => ({ id: g.id, label: g.name }))}
                selectedId={gameId}
                onSelect={(id, label) => {
                  setGameId(id as GameId);
                  setGameName(label);
                }}
              />
            )}

            {/* ── Date ── */}
            <SectionLabel>{Copy.plays.dateLabel}</SectionLabel>
            <View className="mb-2 flex-row gap-2">
              {[0, 1].map((n) => {
                const val = daysAgo(n);
                const label = n === 0 ? Copy.plays.today : Copy.plays.yesterday;
                const active = dateStr === val;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setDateStr(val)}
                    accessibilityRole="button"
                    className={`rounded-full border px-3 py-1.5 ${active ? 'border-[#6D5DF6] bg-[#6D5DF6]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'}`}
                  >
                    <Text className="text-xs text-[#F9F9F9]">{label}</Text>
                  </TouchableOpacity>
                );
              })}
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

            {/* ── Location ── */}
            <SectionLabel>{Copy.plays.locationLabel}</SectionLabel>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder={Copy.plays.locationPlaceholder}
              placeholderTextColor="#525252"
              value={locationText}
              onChangeText={(t) => {
                setLocationText(t);
                setLocationId(null);
              }}
            />
            {locationItems.length > 0 && (
              <ChipRow
                items={locationItems}
                selectedId={locationId}
                onSelect={(id, label) => {
                  setLocationId(id as LocationId);
                  setLocationText(label);
                }}
              />
            )}

            {/* ── Participants ── */}
            <SectionLabel>{Copy.plays.participantsLabel}</SectionLabel>
            {participantDrafts.map((draft) => (
              <ParticipantRow
                key={draft.key}
                draft={draft}
                players={playerItems.map((p) => ({ id: p.id as PlayerId, name: p.label }))}
                onChange={(updated) => updateParticipant(draft.key, updated)}
                onRemove={() => removeParticipant(draft.key)}
              />
            ))}
            <TouchableOpacity
              onPress={addParticipant}
              accessibilityRole="button"
              className="mt-1 items-start"
            >
              <Text className="text-sm text-[#6D5DF6]">{Copy.plays.addParticipant}</Text>
            </TouchableOpacity>

            {/* ── Duration ── */}
            <SectionLabel>{Copy.plays.durationLabel}</SectionLabel>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder="0"
              placeholderTextColor="#525252"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />

            {/* ── Note ── */}
            <SectionLabel>{Copy.plays.noteLabel}</SectionLabel>
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
