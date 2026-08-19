import { useLocalSearchParams, useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MetaChip } from '@/components/MetaChip';
import { Copy } from '@/constants/copy';
import { useBggThing } from '@/features/collection/hooks/useBggThing';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { useRemoveGame } from '@/features/collection/hooks/useRemoveGame';
import { useUpdateGame } from '@/features/collection/hooks/useUpdateGame';
import { usePlays } from '@/features/plays/hooks/usePlays';
import type { GameId } from '@/types';

function StatCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="mb-3 w-1/2 pr-3">
      <Text className="text-xs uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="mt-0.5 text-base text-[#F9F9F9]">{value}</Text>
    </View>
  );
}

export default function GameDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: games = [] } = useCollection();
  const { data: plays = [] } = usePlays();
  const updateGame = useUpdateGame();
  const removeGame = useRemoveGame();

  const game = games.find((g) => g.id === id) ?? null;
  const { data: thing } = useBggThing(game?.bggId);

  const [notes, setNotes] = useState(game?.notes ?? '');

  if (game === null) {
    return (
      <View
        style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}
        className="items-center justify-center px-8"
      >
        <Text className="text-base text-neutral-400">{Copy.gameDetail.notFound}</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2">
          <Text className="text-sm text-[#818CF8]">‹ {Copy.tabs.collection}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gamePlays = plays
    .filter((p) => p.gameId === game.id)
    .sort((a, b) => b.playedAt - a.playedAt);
  const playCount = gamePlays.length;

  const minPlayers = game.minPlayers ?? thing?.minPlayers;
  const maxPlayers = game.maxPlayers ?? thing?.maxPlayers;
  const playingTime = game.playingTime ?? thing?.playingTime;
  const weight = game.averageWeight ?? thing?.averageWeight;
  const rating = game.bggRating ?? thing?.bggRating;
  const rank = game.bggRank ?? thing?.bggRank;
  const imageUrl = thing?.imageUrl ?? game.thumbnailUrl;

  const playersValue = Copy.collection.playersLabel(minPlayers, maxPlayers) || Copy.gameDetail.dash;

  const gameId: GameId = game.id;

  function handleNotesBlur() {
    const trimmed = notes.trim();
    if (trimmed !== (game?.notes ?? '')) {
      updateGame.mutate({ gameId, patch: { notes: trimmed } });
    }
  }

  function handleRemove() {
    Alert.alert(Copy.collection.removeConfirmTitle, Copy.collection.removeConfirmBody, [
      { text: Copy.collection.cancel, style: 'cancel' },
      {
        text: Copy.collection.remove,
        style: 'destructive',
        onPress: () => {
          removeGame.mutate(gameId);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel={Copy.tabs.collection}
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-[#F9F9F9]" numberOfLines={1}>
          {game.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <View className="flex-row">
          {imageUrl !== undefined ? (
            <Image source={{ uri: imageUrl }} className="h-28 w-28 rounded-xl bg-[#2A2A2A]" />
          ) : (
            <View className="h-28 w-28 items-center justify-center rounded-xl bg-[#2A2A2A]">
              <Text className="text-4xl">🎲</Text>
            </View>
          )}
          <View className="ml-4 flex-1 justify-center">
            <Text className="text-xl font-bold text-[#F9F9F9]">{game.name}</Text>
            {game.yearPublished !== undefined && (
              <Text className="mt-1 text-sm text-neutral-500">{game.yearPublished}</Text>
            )}
          </View>
        </View>

        <Text className="mb-3 mt-6 text-base font-semibold text-[#F9F9F9]">
          {Copy.gameDetail.statsTitle}
        </Text>
        <View className="flex-row flex-wrap rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-4">
          <StatCell label={Copy.gameDetail.playersLabel} value={playersValue} />
          <StatCell
            label={Copy.gameDetail.playTimeLabel}
            value={
              playingTime !== undefined
                ? Copy.gameDetail.minutes(playingTime)
                : Copy.gameDetail.dash
            }
          />
          <StatCell
            label={Copy.gameDetail.weightLabel}
            value={
              weight !== undefined ? Copy.gameDetail.weightValue(weight) : Copy.gameDetail.dash
            }
          />
          <StatCell
            label={Copy.gameDetail.ratingLabel}
            value={
              rating !== undefined ? Copy.gameDetail.ratingValue(rating) : Copy.gameDetail.dash
            }
          />
          <StatCell
            label={Copy.gameDetail.rankLabel}
            value={rank !== undefined ? `#${rank}` : Copy.gameDetail.dash}
          />
          <StatCell label={Copy.gameDetail.playsLabel} value={String(playCount)} />
        </View>

        {/* Categories & Mechanics */}
        {((game.categories?.length ?? 0) > 0 || (game.mechanics?.length ?? 0) > 0) && (
          <>
            <Text className="mb-2 mt-6 text-base font-semibold text-[#F9F9F9]">
              {Copy.gameDetail.categoriesTitle}
            </Text>
            <View className="flex-row flex-wrap rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
              {game.categories?.map((c) => (
                <MetaChip key={c} label={c} color="#818CF8" />
              ))}
              {game.mechanics?.map((m) => (
                <MetaChip key={m} label={m} color="#34D399" />
              ))}
            </View>
          </>
        )}

        <Text className="mb-2 mt-6 text-base font-semibold text-[#F9F9F9]">
          {Copy.gameDetail.notesTitle}
        </Text>
        <TextInput
          className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3 text-sm text-[#F9F9F9]"
          placeholder={Copy.gameDetail.notesPlaceholder}
          placeholderTextColor="#525252"
          value={notes}
          onChangeText={setNotes}
          onBlur={handleNotesBlur}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        {/* Play history */}
        <Text className="mb-2 mt-6 text-base font-semibold text-[#F9F9F9]">
          {Copy.gameDetail.playsHistoryTitle}
        </Text>
        {gamePlays.length === 0 ? (
          <Text className="text-sm text-neutral-500">{Copy.gameDetail.noPlaysYet}</Text>
        ) : (
          <View className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
            {gamePlays.map((play, i) => {
              const date = new Date(play.playedAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const meta = [
                play.playerCount !== undefined ? Copy.plays.playersShort(play.playerCount) : null,
                play.durationMinutes !== undefined
                  ? Copy.plays.durationShort(play.durationMinutes)
                  : null,
                play.location ?? null,
              ]
                .filter(Boolean)
                .join('  ·  ');
              return (
                <View
                  key={play.id}
                  className={`px-4 py-3 ${i < gamePlays.length - 1 ? 'border-b border-[#2A2A2A]' : ''}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-[#F9F9F9]">{date}</Text>
                    {meta.length > 0 && <Text className="text-xs text-neutral-500">{meta}</Text>}
                  </View>
                  {play.note !== undefined && play.note.length > 0 && (
                    <Text className="mt-1 text-xs italic text-neutral-400">"{play.note}"</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          onPress={handleRemove}
          accessibilityRole="button"
          className="mt-8 rounded-xl border border-red-500/40 px-4 py-3.5"
        >
          <Text className="text-center text-sm font-semibold text-red-400">
            {Copy.gameDetail.remove}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
