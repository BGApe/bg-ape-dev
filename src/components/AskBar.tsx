import { useRouter } from 'expo-router';
import type React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { Copy } from '@/constants/copy';

/**
 * Persistent "Ask BG Ape anything" shortcut shown at the top of every main screen.
 * Keeps content below the Expo dev-client overlay and gives one-tap access to chat.
 */
export function AskBar(): React.JSX.Element {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(app)/intent', params: { reason: 'general' } })}
      accessibilityRole="button"
      className="mx-4 mb-3 flex-row items-center gap-2 rounded-2xl border border-[#6D5DF6]/50 bg-[#6D5DF6]/15 px-4 py-3"
    >
      <Text className="text-base">✨</Text>
      <Text className="flex-1 text-sm font-semibold text-[#F9F9F9]">{Copy.home.askAnything}</Text>
      <Text className="text-neutral-500">›</Text>
    </TouchableOpacity>
  );
}
