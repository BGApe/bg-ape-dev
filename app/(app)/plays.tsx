import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AskBar } from '@/components/AskBar';
import { Copy } from '@/constants/copy';
import { LogPlaySheet } from '@/features/plays/components/LogPlaySheet';
import { PlayRow } from '@/features/plays/components/PlayRow';
import { useDeletePlay } from '@/features/plays/hooks/useDeletePlay';
import { useLogPlay } from '@/features/plays/hooks/useLogPlay';
import { usePlays } from '@/features/plays/hooks/usePlays';
import { useUpdatePlay } from '@/features/plays/hooks/useUpdatePlay';
import type { NewPlay, Play } from '@/features/plays/types';
import type { PlayId } from '@/types';

export default function PlaysScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: plays = [], isLoading } = usePlays();
  const logPlay = useLogPlay();
  const updatePlay = useUpdatePlay();
  const deletePlay = useDeletePlay();

  const [isLogging, setIsLogging] = useState(false);

  function handleSubmit(input: NewPlay) {
    setIsLogging(false);
    logPlay.mutate(input);
  }

  function handleSaveNote(playId: PlayId, note: string) {
    updatePlay.mutate({ playId, patch: { note } });
  }

  function handleDelete(play: Play) {
    Alert.alert(Copy.plays.deleteTitle, Copy.plays.deleteBody, [
      { text: Copy.plays.cancel, style: 'cancel' },
      { text: Copy.plays.delete, style: 'destructive', onPress: () => deletePlay.mutate(play.id) },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', paddingTop: insets.top + 4 }}>
      <AskBar />

      <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="px-2 py-1"
          accessibilityRole="button"
          accessibilityLabel={Copy.tabs.home}
        >
          <Text className="text-lg text-neutral-300">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-[#F9F9F9]">{Copy.plays.title}</Text>
        <TouchableOpacity
          onPress={() => setIsLogging(true)}
          accessibilityRole="button"
          className="rounded-full bg-[#6D5DF6] px-3 py-1.5"
        >
          <Text className="text-sm font-semibold text-white">{Copy.plays.logButton}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6D5DF6" />
        </View>
      ) : plays.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-neutral-400">{Copy.plays.empty}</Text>
        </View>
      ) : (
        <FlashList
          data={plays}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlayRow play={item} onSaveNote={handleSaveNote} onDelete={handleDelete} />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <LogPlaySheet
        visible={isLogging}
        onClose={() => setIsLogging(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
