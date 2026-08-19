import type React from 'react';
import { Image, Text, View } from 'react-native';

import { MetaChip, ratingColor, weightColor } from '@/components/MetaChip';
import type { CollectionGame } from '@/features/collection/types';

type Props = {
  /** Game name — always shown even if not in collection. */
  gameName: string;
  /** Full collection entry; provides thumbnail + rich stats when available. */
  game: CollectionGame | undefined;
};

/**
 * Compact BGG info card pinned at the top of a chat thread that targets a
 * specific game. Shows thumbnail, core stats chips, and top mechanics.
 * Rendered as the FlashList header so it scrolls away naturally.
 */
export function GameContextCard({ gameName, game }: Props): React.JSX.Element {
  const imageUrl = game?.thumbnailUrl;

  return (
    <View className="mx-4 mt-3 mb-1 flex-row items-center rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3">
      {imageUrl !== undefined ? (
        <Image source={{ uri: imageUrl }} className="mr-3 h-14 w-14 rounded-xl bg-[#2A2A2A]" />
      ) : (
        <View className="mr-3 h-14 w-14 items-center justify-center rounded-xl bg-[#2A2A2A]">
          <Text className="text-2xl">🎲</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="text-sm font-semibold text-[#F9F9F9]" numberOfLines={1}>
          {gameName}
        </Text>
        {game?.yearPublished !== undefined && (
          <Text className="text-xs text-neutral-500">{game.yearPublished}</Text>
        )}

        {game !== undefined && (
          <View className="mt-1.5 flex-row flex-wrap">
            {game.minPlayers !== undefined && game.maxPlayers !== undefined && (
              <MetaChip
                label={
                  game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers}p`
                    : `${game.minPlayers}–${game.maxPlayers}p`
                }
                color="#525252"
              />
            )}
            {game.playingTime !== undefined && (
              <MetaChip label={`⏱ ${game.playingTime}m`} color="#525252" />
            )}
            {game.averageWeight !== undefined && (
              <MetaChip
                label={`⚖ ${game.averageWeight.toFixed(1)}`}
                color={weightColor(game.averageWeight)}
              />
            )}
            {game.bggRating !== undefined && (
              <MetaChip
                label={`★ ${game.bggRating.toFixed(1)}`}
                color={ratingColor(game.bggRating)}
              />
            )}
            {game.mechanics?.slice(0, 2).map((m) => (
              <MetaChip key={m} label={m} color="#818CF8" />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
