import type React from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Copy } from '@/constants/copy';
import { bggClient } from '@/services/bgg/BggClient';
import type { BggSearchResult, BggThing } from '@/services/bgg/types';

import { useBggSearch } from '../hooks/useBggSearch';
import type { NewCollectionGame } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (game: NewCollectionGame) => void;
};

/** Maps a BGG search hit (+ optional full details) to a new collection game. */
function toNewGame(result: BggSearchResult, thing: BggThing | null): NewCollectionGame {
  const game: NewCollectionGame = { name: result.name, source: 'bgg', bggId: result.bggId };

  const year = thing?.yearPublished ?? result.yearPublished;
  if (year !== undefined) game.yearPublished = year;
  if (thing?.thumbnailUrl !== undefined) game.thumbnailUrl = thing.thumbnailUrl;
  if (thing?.minPlayers !== undefined) game.minPlayers = thing.minPlayers;
  if (thing?.maxPlayers !== undefined) game.maxPlayers = thing.maxPlayers;
  if (thing?.playingTime !== undefined) game.playingTime = thing.playingTime;
  if (thing?.averageWeight !== undefined) game.averageWeight = thing.averageWeight;
  if (thing?.bggRating !== undefined) game.bggRating = thing.bggRating;
  if (thing?.bggRank !== undefined) game.bggRank = thing.bggRank;

  return game;
}

export function AddGameSheet({ visible, onClose, onAdd }: Props): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useBggSearch(debounced);

  function reset() {
    setQuery('');
    setDebounced('');
    setAddingId(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePick(result: BggSearchResult) {
    setAddingId(result.bggId);
    const thing = await bggClient.getThing(result.bggId);
    onAdd(toNewGame(result, thing));
    reset();
    onClose();
  }

  function handleManualAdd() {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    onAdd({ name: trimmed, source: 'manual' });
    reset();
    onClose();
  }

  const showManual = query.trim().length > 0 && addingId === null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={handleClose}>
        <Pressable
          className="h-[80%] rounded-t-3xl border-t border-[#2A2A2A] bg-[#141414] px-5 pt-4"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 items-center">
            <View className="h-1 w-10 rounded-full bg-[#3A3A3A]" />
          </View>
          <Text className="mb-3 text-lg font-bold text-[#F9F9F9]">{Copy.collection.addTitle}</Text>

          <TextInput
            className="rounded-xl bg-[#1F1F1F] px-4 py-3 text-base text-[#F9F9F9]"
            placeholder={Copy.collection.searchPlaceholder}
            placeholderTextColor="#525252"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />

          <ScrollView className="mt-3" keyboardShouldPersistTaps="handled">
            {isFetching && (
              <View className="py-6">
                <ActivityIndicator color="#6D5DF6" />
              </View>
            )}

            {!isFetching &&
              results.map((result) => (
                <TouchableOpacity
                  key={result.bggId}
                  onPress={() => void handlePick(result)}
                  disabled={addingId !== null}
                  accessibilityRole="button"
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3"
                >
                  <Text className="flex-1 pr-2 text-base text-[#F9F9F9]" numberOfLines={1}>
                    {result.name}
                    {result.yearPublished !== undefined && (
                      <Text className="text-neutral-500"> ({result.yearPublished})</Text>
                    )}
                  </Text>
                  {addingId === result.bggId ? (
                    <ActivityIndicator color="#6D5DF6" />
                  ) : (
                    <Text className="text-[#818CF8]">+</Text>
                  )}
                </TouchableOpacity>
              ))}

            {!isFetching && debounced.trim().length >= 2 && results.length === 0 && (
              <Text className="py-4 text-center text-sm text-neutral-500">
                {Copy.collection.noResults}
              </Text>
            )}

            {showManual && (
              <TouchableOpacity
                onPress={handleManualAdd}
                accessibilityRole="button"
                className="mb-2 mt-1 rounded-xl border border-dashed border-[#3A3A3A] px-4 py-3"
              >
                <Text className="text-sm text-neutral-300">
                  {Copy.collection.addManually(query.trim())}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
