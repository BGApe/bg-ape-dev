import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { Copy } from '@/constants/copy';
import { AddGameSheet } from '@/features/collection/components/AddGameSheet';
import { useAddGame } from '@/features/collection/hooks/useAddGame';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { useRemoveGame } from '@/features/collection/hooks/useRemoveGame';
import type { CollectionGame, NewCollectionGame } from '@/features/collection/types';
import { usePlays } from '@/features/plays/hooks/usePlays';

function ownedSince(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function GameRow({
  game,
  plays,
  onOpen,
  onRemove,
}: {
  game: CollectionGame;
  plays: number;
  onOpen: (game: CollectionGame) => void;
  onRemove: (game: CollectionGame) => void;
}): React.JSX.Element {
  const meta = [
    game.yearPublished ? String(game.yearPublished) : null,
    Copy.collection.playersLabel(game.minPlayers, game.maxPlayers) || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const stats = [
    Copy.collection.playsLabel(plays),
    Copy.collection.ownedSince(ownedSince(game.addedAt)),
    game.bggRank !== undefined ? Copy.collection.rankLabel(game.bggRank) : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <TouchableOpacity
      onPress={() => onOpen(game)}
      accessibilityRole="button"
      className="mx-4 mb-2 flex-row items-center rounded-xl bg-[#1A1A1A] px-3 py-3"
    >
      {game.thumbnailUrl ? (
        <Image
          source={{ uri: game.thumbnailUrl }}
          className="mr-3 h-12 w-12 rounded-lg bg-[#2A2A2A]"
        />
      ) : (
        <View className="mr-3 h-12 w-12 items-center justify-center rounded-lg bg-[#2A2A2A]">
          <Text className="text-lg">🎲</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
          {game.name}
        </Text>
        {meta.length > 0 && <Text className="mt-0.5 text-xs text-neutral-500">{meta}</Text>}
        <Text className="mt-0.5 text-xs text-neutral-400">{stats}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onRemove(game)}
        className="ml-2 px-3 py-2"
        accessibilityRole="button"
        accessibilityLabel={Copy.collection.remove}
      >
        <Text className="text-lg text-neutral-600">✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function CollectionScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: games = [], isLoading } = useCollection();
  const { data: plays = [] } = usePlays();
  const addGame = useAddGame();
  const removeGame = useRemoveGame();
  const [isAdding, setIsAdding] = useState(false);

  const playsByGame = useMemo(() => {
    const counts = new Map<string, number>();
    for (const play of plays) {
      if (play.gameId !== undefined) {
        counts.set(play.gameId, (counts.get(play.gameId) ?? 0) + 1);
      }
    }
    return counts;
  }, [plays]);

  function handleAdd(game: NewCollectionGame) {
    addGame.mutate(game);
  }

  function handleOpen(game: CollectionGame) {
    router.push({ pathname: '/(app)/game', params: { id: game.id } });
  }

  function handleRemove(game: CollectionGame) {
    Alert.alert(Copy.collection.removeConfirmTitle, Copy.collection.removeConfirmBody, [
      { text: Copy.collection.cancel, style: 'cancel' },
      {
        text: Copy.collection.remove,
        style: 'destructive',
        onPress: () => removeGame.mutate(game.id),
      },
    ]);
  }

  return (
    <View className="flex-1 bg-[#0F0F0F]" style={{ paddingTop: insets.top + 4 }}>
      <AskBar />

      <View className="flex-row items-center justify-between px-6 pb-3">
        <View>
          <Text className="text-2xl font-bold text-[#F9F9F9]">{Copy.collection.title}</Text>
          {games.length > 0 && (
            <Text className="mt-1 text-sm text-neutral-500">
              {Copy.collection.countLabel(games.length)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          accessibilityRole="button"
          accessibilityLabel={Copy.collection.addButton}
          className="h-10 w-10 items-center justify-center rounded-full bg-indigo-600"
        >
          <Text className="text-xl font-semibold text-white">+</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : games.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-center text-base text-neutral-400">{Copy.collection.empty}</Text>
        </View>
      ) : (
        <FlashList
          data={games}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GameRow
              game={item}
              plays={playsByGame.get(item.id) ?? 0}
              onOpen={handleOpen}
              onRemove={handleRemove}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <AddGameSheet visible={isAdding} onClose={() => setIsAdding(false)} onAdd={handleAdd} />
    </View>
  );
}
