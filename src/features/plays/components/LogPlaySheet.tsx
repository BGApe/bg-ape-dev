import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { useCollection } from '@/features/collection/hooks/useCollection';
import type { CollectionGame } from '@/features/collection/types';
import { useLocations } from '@/features/locations/hooks/useLocations';
import { usePlayers } from '@/features/players/hooks/usePlayers';
import type { GameId, LocationId, PlayerId } from '@/types';

import { LogPlaySchema } from '../schemas';
import type { NewPlay, NewPlayParticipant, Play } from '../types';

import { SimpleCalendar } from './SimpleCalendar';

type ParticipantDraft = {
  key: string;
  playerId: PlayerId | null;
  name: string;
  score: string;
  won: boolean;
  isSelf: boolean;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  return <Text className="mb-1 mt-4 text-sm text-neutral-400">{children}</Text>;
}

function ChipRow({
  items,
  selectedId,
  onSelect,
  selectedIds,
  multi,
  emphasizeId,
}: {
  items: { id: string; label: string }[];
  selectedId?: string | null;
  selectedIds?: Set<string>;
  onSelect: (id: string, label: string) => void;
  multi?: boolean;
  emphasizeId?: string | undefined;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
      <View className="flex-row gap-2">
        {items.map((item) => {
          const active = multi ? (selectedIds?.has(item.id) ?? false) : item.id === selectedId;
          const emphasize = emphasizeId !== undefined && item.id === emphasizeId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id, item.label)}
              accessibilityRole="button"
              hitSlop={4}
              className={`rounded-full border px-3 py-1.5 ${
                active
                  ? 'border-[#6D5DF6] bg-[#6D5DF6]/15'
                  : emphasize
                    ? 'border-[#3A3A3A] bg-[#121212]'
                    : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <Text
                className={`text-xs ${emphasize && !active ? 'text-neutral-300' : 'text-[#F9F9F9]'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ParticipantRow({
  draft,
  onChange,
  onRemove,
}: {
  draft: ParticipantDraft;
  onChange: (updated: ParticipantDraft) => void;
  onRemove: () => void;
}): React.JSX.Element {
  return (
    <View
      className={`mb-2 rounded-xl border px-3 py-2 ${
        draft.isSelf ? 'border-[#3A3A3A] bg-[#121212]' : 'border-[#2A2A2A] bg-[#1F1F1F]'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm text-[#F9F9F9]" numberOfLines={1}>
          {draft.name}
        </Text>
        <Pressable
          onPress={() => onChange({ ...draft, won: !draft.won })}
          accessibilityRole="button"
          hitSlop={4}
          className={`rounded-full border px-2 py-1 ${
            draft.won ? 'border-yellow-500 bg-yellow-500/15' : 'border-[#3A3A3A] bg-transparent'
          }`}
        >
          <Text className={`text-xs ${draft.won ? 'text-yellow-400' : 'text-neutral-500'}`}>
            {Copy.plays.wonLabel}
          </Text>
        </Pressable>
        <Pressable onPress={onRemove} accessibilityRole="button" hitSlop={8} className="px-1">
          <Text className="text-base text-neutral-600">✕</Text>
        </Pressable>
      </View>
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
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (play: NewPlay) => void;
  /** When set, sheet is in edit mode and pre-fills from this play. */
  initialPlay?: Play | null;
};

function selfDraft(
  players: { id: PlayerId; name: string; isSelf?: boolean }[],
): ParticipantDraft[] {
  const self = players.find((p) => p.isSelf === true);
  if (self === undefined) return [];
  return [
    {
      key: `self-${self.id}`,
      playerId: self.id,
      name: self.name,
      score: '',
      won: false,
      isSelf: true,
    },
  ];
}

export function LogPlaySheet({
  visible,
  onClose,
  onSubmit,
  initialPlay = null,
}: Props): React.JSX.Element {
  const { data: games = [] } = useCollection();
  const { data: players = [] } = usePlayers();
  const { data: locations = [] } = useLocations();

  const baseGames = useMemo(() => games.filter((g) => g.kind !== 'expansion'), [games]);

  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [selectedExpansionIds, setSelectedExpansionIds] = useState<Set<GameId>>(new Set());
  const [dateStr, setDateStr] = useState(toDateStr(new Date()));
  const [showCalendar, setShowCalendar] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [participantDrafts, setParticipantDrafts] = useState<ParticipantDraft[]>([]);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const availableExpansions: CollectionGame[] = useMemo(() => {
    if (gameId === null) return [];
    const selected = games.find((g) => g.id === gameId);
    if (selected?.bggId === undefined) return [];
    return games.filter((g) => g.kind === 'expansion' && g.parentBggId === selected.bggId);
  }, [gameId, games]);

  useEffect(() => {
    if (!visible) {
      setHydrated(false);
      return;
    }
    if (hydrated) return;

    if (initialPlay !== null) {
      setGameName(initialPlay.gameName);
      setGameId(initialPlay.gameId ?? null);
      setSelectedExpansionIds(new Set(initialPlay.expansionIds ?? []));
      setDateStr(toDateStr(new Date(initialPlay.playedAt)));
      setLocationText(initialPlay.locationName ?? initialPlay.location ?? '');
      setLocationId(initialPlay.locationId ?? null);
      setParticipantDrafts(
        (initialPlay.participants ?? []).map((p, i) => {
          const isSelf = players.some((pl) => pl.id === p.playerId && pl.isSelf === true);
          return {
            key: `edit-${p.playerId}-${i}`,
            playerId: p.playerId,
            name: p.name,
            score: p.score !== undefined ? String(p.score) : '',
            won: p.won,
            isSelf,
          };
        }),
      );
      setDuration(
        initialPlay.durationMinutes !== undefined ? String(initialPlay.durationMinutes) : '',
      );
      setNote(initialPlay.note ?? '');
      setShowCalendar(false);
      setError(null);
    } else {
      setGameName('');
      setGameId(null);
      setSelectedExpansionIds(new Set());
      setDateStr(toDateStr(new Date()));
      setLocationText('');
      setLocationId(null);
      setParticipantDrafts(selfDraft(players));
      setDuration('');
      setNote('');
      setShowCalendar(false);
      setError(null);
    }
    setHydrated(true);
  }, [visible, initialPlay, players, hydrated]);

  function resetForm() {
    setHydrated(false);
    setGameName('');
    setGameId(null);
    setSelectedExpansionIds(new Set());
    setDateStr(toDateStr(new Date()));
    setLocationText('');
    setLocationId(null);
    setParticipantDrafts(selfDraft(players));
    setDuration('');
    setNote('');
    setShowCalendar(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function togglePlayerChip(id: string, label: string) {
    const playerId = id as PlayerId;
    setParticipantDrafts((prev) => {
      const existing = prev.find((d) => d.playerId === playerId);
      if (existing !== undefined) {
        return prev.filter((d) => d.playerId !== playerId);
      }
      const isSelf = players.some((p) => p.id === playerId && p.isSelf === true);
      return [
        ...prev,
        {
          key: `chip-${playerId}`,
          playerId,
          name: label,
          score: '',
          won: false,
          isSelf,
        },
      ];
    });
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

    if (selectedExpansionIds.size > 0) {
      const ids = [...selectedExpansionIds];
      const names = ids
        .map((id) => games.find((g) => g.id === id)?.name)
        .filter((name): name is string => name !== undefined);
      play.expansionIds = ids;
      play.expansionNames = names;
    } else if (initialPlay !== null) {
      play.expansionIds = [];
      play.expansionNames = [];
    }

    onSubmit(play);
    resetForm();
  }

  const locationItems = locations.map((l) => ({ id: l.id, label: l.name }));
  const playerItems = players.map((p) => ({ id: p.id, label: p.name }));
  const selectedPlayerIds = new Set(
    participantDrafts.map((d) => d.playerId).filter((id): id is PlayerId => id !== null),
  );
  const selfId = players.find((p) => p.isSelf === true)?.id;
  const editing = initialPlay !== null;

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
            <Text className="mb-4 text-lg font-bold text-[#F9F9F9]">
              {editing ? Copy.plays.editPlay : Copy.plays.formTitle}
            </Text>

            <SectionLabel>{Copy.plays.gameLabel}</SectionLabel>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder={Copy.plays.gamePlaceholder}
              placeholderTextColor="#525252"
              value={gameName}
              onChangeText={(t) => {
                setGameName(t);
                setGameId(null);
                setSelectedExpansionIds(new Set());
              }}
            />
            {baseGames.length > 0 && (
              <ChipRow
                items={baseGames.map((g) => ({ id: g.id, label: g.name }))}
                selectedId={gameId}
                onSelect={(id, label) => {
                  setGameId(id as GameId);
                  setGameName(label);
                  setSelectedExpansionIds(new Set());
                }}
              />
            )}

            {availableExpansions.length > 0 && (
              <>
                <SectionLabel>{Copy.plays.expansionsLabel}</SectionLabel>
                <Text className="mb-1 text-xs text-neutral-500">{Copy.plays.expansionsHint}</Text>
                <ChipRow
                  items={availableExpansions.map((g) => ({ id: g.id, label: g.name }))}
                  multi
                  selectedIds={selectedExpansionIds as Set<string>}
                  onSelect={(id) => {
                    const gid = id as GameId;
                    setSelectedExpansionIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(gid)) next.delete(gid);
                      else next.add(gid);
                      return next;
                    });
                  }}
                />
              </>
            )}

            <SectionLabel>{Copy.plays.dateLabel}</SectionLabel>
            <View className="mb-2 flex-row gap-2">
              {[0, 1].map((n) => {
                const val = daysAgo(n);
                const label = n === 0 ? Copy.plays.today : Copy.plays.yesterday;
                const active = dateStr === val && !showCalendar;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      setDateStr(val);
                      setShowCalendar(false);
                    }}
                    accessibilityRole="button"
                    className={`rounded-full border px-3 py-1.5 ${active ? 'border-[#6D5DF6] bg-[#6D5DF6]/15' : 'border-[#2A2A2A] bg-[#1A1A1A]'}`}
                  >
                    <Text className="text-xs text-[#F9F9F9]">{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setShowCalendar((v) => !v)}
              accessibilityRole="button"
              className="rounded-xl bg-[#1F1F1F] px-4 py-3"
            >
              <Text className="text-sm text-[#F9F9F9]">{dateStr || Copy.plays.pickDate}</Text>
            </Pressable>
            {showCalendar ? (
              <SimpleCalendar
                value={dateStr}
                onChange={(next) => {
                  setDateStr(next);
                  setShowCalendar(false);
                }}
              />
            ) : null}

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

            <SectionLabel>{Copy.plays.participantsLabel}</SectionLabel>
            <Text className="mb-1 text-xs text-neutral-500">{Copy.plays.participantsHint}</Text>
            <ChipRow
              items={playerItems}
              multi
              selectedIds={selectedPlayerIds as Set<string>}
              emphasizeId={selfId}
              onSelect={togglePlayerChip}
            />
            {participantDrafts.map((draft) => (
              <ParticipantRow
                key={draft.key}
                draft={draft}
                onChange={(updated) =>
                  setParticipantDrafts((prev) =>
                    prev.map((d) => (d.key === draft.key ? updated : d)),
                  )
                }
                onRemove={() =>
                  setParticipantDrafts((prev) => prev.filter((d) => d.key !== draft.key))
                }
              />
            ))}

            <SectionLabel>{Copy.plays.durationLabel}</SectionLabel>
            <TextInput
              className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-sm text-[#F9F9F9]"
              placeholder="0"
              placeholderTextColor="#525252"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />

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

            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              className="mt-5 items-center rounded-2xl bg-[#6D5DF6] py-4"
            >
              <Text className="text-base font-semibold text-white">
                {editing ? Copy.plays.saveEdit : Copy.plays.save}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              className="mt-2 items-center py-3"
            >
              <Text className="text-sm text-neutral-400">{Copy.plays.cancel}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
