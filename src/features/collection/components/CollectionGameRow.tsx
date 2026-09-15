import type React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Copy } from '@/constants/copy';
import type { GamePlayStats } from '@/features/plays/lib/gamePlayStats';
import { formatLastPlayRelative, gameTags } from '@/features/plays/lib/gamePlayStats';

import type { CollectionGame } from '../types';

type Props = {
  game: CollectionGame;
  stats: GamePlayStats;
  ownedExpansionCount: number;
  onOpen: (game: CollectionGame) => void;
  onRemove: (game: CollectionGame) => void;
  onTagPress: (tag: string) => void;
};

function ownedSinceShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function CollectionGameRow({
  game,
  stats,
  ownedExpansionCount,
  onOpen,
  onRemove,
  onTagPress,
}: Props): React.JSX.Element {
  const C = Copy.collection;
  const top = [
    game.yearPublished !== undefined ? String(game.yearPublished) : null,
    C.playersLabel(game.minPlayers, game.maxPlayers) || null,
    game.averageWeight !== undefined ? C.weightShort(game.averageWeight) : null,
    game.playingTime !== undefined ? C.timeShort(game.playingTime) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const middle = [
    C.playsLabel(stats.playCount),
    C.winsLabel(stats.wins),
    C.lastPlayLabel(formatLastPlayRelative(stats.lastPlayedAt, Copy.gameDetail.dash)),
    C.ownedSinceShort(ownedSinceShort(game.addedAt)),
  ].join(' · ');

  const tags = gameTags(game, 4);

  return (
    <View className="mx-4 mb-2 rounded-xl bg-[#1A1A1A] px-3 py-3">
      <View className="flex-row items-start">
        <Pressable onPress={() => onOpen(game)} accessibilityRole="button" className="mr-3">
          {game.thumbnailUrl ? (
            <Image
              source={{ uri: game.thumbnailUrl }}
              className="h-12 w-12 rounded-lg bg-[#2A2A2A]"
            />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-lg bg-[#2A2A2A]">
              <Text className="text-lg">🎲</Text>
            </View>
          )}
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => onOpen(game)}
              accessibilityRole="button"
              className="min-w-0 flex-1"
            >
              <Text className="text-base font-semibold text-[#F9F9F9]" numberOfLines={1}>
                {game.name}
                {ownedExpansionCount > 0 ? (
                  <Text className="text-sm font-medium text-neutral-400">
                    {`  +${ownedExpansionCount}`}
                  </Text>
                ) : null}
                {game.kind === 'expansion' ? (
                  <Text className="text-sm font-normal text-neutral-500"> · exp</Text>
                ) : null}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemove(game)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={C.remove}
              className="ml-2 px-2 py-1"
            >
              <Text className="text-lg text-neutral-600">✕</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onOpen(game)} accessibilityRole="button">
            {top.length > 0 && <Text className="mt-0.5 text-xs text-neutral-500">{top}</Text>}
            <Text className="mt-0.5 text-xs text-neutral-400" numberOfLines={2}>
              {middle}
            </Text>
          </Pressable>
          {tags.length > 0 && (
            <View className="mt-2 flex-row flex-wrap">
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => onTagPress(tag)}
                  hitSlop={4}
                  accessibilityRole="button"
                  className="mb-1 mr-1.5 rounded-full border border-[#3A3A3A] bg-[#222] px-2.5 py-1"
                >
                  <Text className="text-[11px] text-[#A5B4FC]">{tag}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
