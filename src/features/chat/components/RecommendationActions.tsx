import { useRouter } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { Copy } from '@/constants/copy';
import { Routes } from '@/constants/routes';
import type { CollectionGame } from '@/features/collection/types';
import { useAddMyListItem } from '@/features/myList/hooks/useAddMyListItem';
import { useMyList } from '@/features/myList/hooks/useMyList';
import { ensureBggGameProfile, type BggGameProfile } from '@/services/bgg/gameProfile';

import { newSegmentId } from '../lib/messageGroups';
import {
  easiestSetupPrompt,
  moreTipsPrompt,
  playerCountFromMessages,
  similarGamesPrompt,
  tipDetailsPrompt,
} from '../lib/replyPrompts';
import { previouslySuggestedGames } from '../lib/suggestedGames';
import type { ChatMessage } from '../types';

const C = Copy.chat.reply;

type SegmentRef = {
  id: string;
  title: string;
};

type Props = {
  mode: 'browse' | 'game';
  game?: string;
  latestGames: string[];
  messages: ChatMessage[];
  games: CollectionGame[];
  disabled: boolean;
  onSend: (text: string, label: string, segment?: SegmentRef) => void;
};

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="mr-2 mb-2 rounded-full border border-[#818CF8] bg-[#818CF8]/15 px-3 py-1.5"
    >
      <Text className="text-sm text-[#C7D2FE]">{label}</Text>
    </TouchableOpacity>
  );
}

function findOwnedGame(games: CollectionGame[], name: string): CollectionGame | undefined {
  const key = name.trim().toLowerCase();
  return games.find((game) => game.kind !== 'expansion' && game.name.toLowerCase() === key);
}

function metadataLine(name: string, profile: BggGameProfile): string {
  const bits = [name];
  if (profile.averageWeight !== undefined) bits.push(`weight ${profile.averageWeight}`);
  if (profile.playingTime !== undefined) bits.push(`${profile.playingTime} min`);
  if (profile.minPlayers !== undefined || profile.maxPlayers !== undefined) {
    bits.push(`${profile.minPlayers ?? '?'}–${profile.maxPlayers ?? '?'} players`);
  }
  const tags = [...profile.mechanics, ...profile.categories].slice(0, 6);
  if (tags.length > 0) bits.push(tags.join(', '));
  return bits.join(' · ');
}

export function RecommendationActions({
  mode,
  game,
  latestGames,
  messages,
  games,
  disabled,
  onSend,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { data: saved = [] } = useMyList();
  const addItem = useAddMyListItem();
  const [ranking, setRanking] = useState(false);
  const savedNames = new Set(saved.map((item) => item.name.trim().toLowerCase()));
  const gameSaved = game !== undefined && savedNames.has(game.trim().toLowerCase());

  function sendFresh(text: string, label: string) {
    onSend(text, label);
  }

  async function rankBySetup() {
    if (latestGames.length === 0 || ranking) return;
    setRanking(true);
    try {
      const notes = await Promise.all(
        latestGames.map(async (name) => {
          const owned = findOwnedGame(games, name);
          try {
            const profile = await ensureBggGameProfile(
              owned?.bggId !== undefined ? { bggId: owned.bggId } : { name },
            );
            return metadataLine(name, profile);
          } catch {
            return name;
          }
        }),
      );
      const prompt = easiestSetupPrompt(latestGames, notes);
      sendFresh(prompt.text, prompt.label);
    } finally {
      setRanking(false);
    }
  }

  if (mode === 'browse') {
    return (
      <View className="mx-4 mb-2 max-w-[90%] flex-row flex-wrap">
        <ActionButton
          label={C.moreTips}
          disabled={disabled}
          onPress={() => {
            const prompt = moreTipsPrompt(previouslySuggestedGames(messages));
            sendFresh(prompt.text, prompt.label);
          }}
        />
        <ActionButton
          label={C.pickerAgain}
          disabled={disabled}
          onPress={() =>
            router.push({ pathname: Routes.intent, params: { reason: 'recommendation' } })
          }
        />
        <ActionButton
          label={ranking ? Copy.chat.thinking : C.easiestSetup}
          disabled={disabled || ranking || latestGames.length === 0}
          onPress={() => {
            void rankBySetup();
          }}
        />
        {ranking && <ActivityIndicator color="#818CF8" size="small" />}
      </View>
    );
  }

  if (game === undefined) return <View />;

  return (
    <View className="mt-3 flex-row flex-wrap">
      <ActionButton
        label={C.tipDetails}
        disabled={disabled}
        onPress={() => {
          const prompt = tipDetailsPrompt(game);
          onSend(prompt.text, prompt.label, {
            id: newSegmentId(),
            title: game.slice(0, 120),
          });
        }}
      />
      <ActionButton
        label={C.howToPlay}
        disabled={disabled}
        onPress={() => {
          const playerCount = playerCountFromMessages(messages);
          const params: Record<string, string> = { reason: 'setup', gameName: game };
          const owned = findOwnedGame(games, game);
          if (owned) params.gameId = owned.id;
          if (playerCount !== undefined) params.playerCount = playerCount;
          router.push({ pathname: Routes.intent, params });
        }}
      />
      <ActionButton
        label={C.similarGames}
        disabled={disabled}
        onPress={() => {
          const prompt = similarGamesPrompt(game, previouslySuggestedGames(messages));
          sendFresh(prompt.text, prompt.label);
        }}
      />
      <ActionButton
        label={gameSaved ? C.savedForLater : C.saveForLater}
        disabled={disabled || gameSaved || addItem.isPending}
        onPress={() => {
          if (gameSaved) return;
          addItem.mutate({ name: game });
        }}
      />
    </View>
  );
}
