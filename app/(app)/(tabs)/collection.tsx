import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type React from 'react';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { Copy } from '@/constants/copy';
import { AddGameSheet } from '@/features/collection/components/AddGameSheet';
import { CollectionFilterBar } from '@/features/collection/components/CollectionFilterBar';
import { CollectionGameRow } from '@/features/collection/components/CollectionGameRow';
import { useAddGame } from '@/features/collection/hooks/useAddGame';
import { useCollection } from '@/features/collection/hooks/useCollection';
import { useRemoveGame } from '@/features/collection/hooks/useRemoveGame';
import {
  DEFAULT_COLLECTION_FILTERS,
  filterCollectionGames,
  sortCollectionGames,
} from '@/features/collection/lib/collectionFilters';
import type {
  CollectionFilters,
  CollectionSort,
} from '@/features/collection/lib/collectionFilters';
import type { CollectionGame, NewCollectionGame } from '@/features/collection/types';
import { useEnsureSelfPlayer } from '@/features/players/hooks/useEnsureSelfPlayer';
import { usePlays } from '@/features/plays/hooks/usePlays';
import { statsByGameId } from '@/features/plays/lib/gamePlayStats';
import type { GameId } from '@/types';

export default function CollectionScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: games = [], isLoading } = useCollection();
  const { data: plays = [] } = usePlays();
  const self = useEnsureSelfPlayer();
  const addGame = useAddGame();
  const removeGame = useRemoveGame();

  const [isAdding, setIsAdding] = useState(false);
  const [filters, setFilters] = useState<CollectionFilters>(DEFAULT_COLLECTION_FILTERS);
  const [sort, setSort] = useState<CollectionSort>('name');
  const [openPanel, setOpenPanel] = useState<'players' | 'complexity' | 'playTime' | 'tags' | null>(
    null,
  );

  const statsMap = useMemo(() => statsByGameId(plays, games, self?.id), [plays, games, self?.id]);

  const expansionCountByParent = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of games) {
      if (g.kind !== 'expansion' || g.parentBggId === undefined) continue;
      map.set(g.parentBggId, (map.get(g.parentBggId) ?? 0) + 1);
    }
    return map;
  }, [games]);

  const visibleGames = useMemo(() => {
    const filtered = filterCollectionGames(games, filters);
    return sortCollectionGames(
      filtered,
      sort,
      (id) => statsMap.get(id as GameId)?.playCount ?? 0,
      (id) => statsMap.get(id as GameId)?.lastPlayedAt,
    );
  }, [games, filters, sort, statsMap]);

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

  function handleTagPress(tag: string) {
    setFilters((prev) => ({ ...prev, tag: prev.tag === tag ? undefined : tag }));
    setOpenPanel('tags');
  }

  return (
    <View className="flex-1 bg-[#0F0F0F]" style={{ paddingTop: insets.top + 4 }}>
      <AskBar />

      <View className="flex-row items-center justify-between px-4 pb-2">
        <View className="flex-1 pr-3">
          <Text className="text-2xl font-bold text-[#F9F9F9]">{Copy.collection.title}</Text>
          {games.length > 0 && (
            <Text className="mt-1 text-sm text-neutral-500">
              {Copy.collection.countLabel(visibleGames.length)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          accessibilityRole="button"
          accessibilityLabel={Copy.collection.addButton}
          className="rounded-xl bg-indigo-600 px-4 py-2.5"
        >
          <Text className="text-sm font-semibold text-white">{Copy.collection.addButton}</Text>
        </TouchableOpacity>
      </View>

      {games.length > 0 && (
        <CollectionFilterBar
          filters={filters}
          sort={sort}
          openPanel={openPanel}
          onChangeFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onChangeSort={setSort}
          onChangePanel={setOpenPanel}
        />
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : games.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-center text-base text-neutral-400">{Copy.collection.empty}</Text>
        </View>
      ) : visibleGames.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-center text-base text-neutral-400">
            {Copy.collection.noFilterMatches}
          </Text>
        </View>
      ) : (
        <FlashList
          data={visibleGames}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CollectionGameRow
              game={item}
              stats={statsMap.get(item.id) ?? { playCount: 0, wins: 0, lastPlayedAt: undefined }}
              ownedExpansionCount={
                item.bggId !== undefined ? (expansionCountByParent.get(item.bggId) ?? 0) : 0
              }
              onOpen={handleOpen}
              onRemove={handleRemove}
              onTagPress={handleTagPress}
            />
          )}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <AddGameSheet visible={isAdding} onClose={() => setIsAdding(false)} onAdd={handleAdd} />
    </View>
  );
}
