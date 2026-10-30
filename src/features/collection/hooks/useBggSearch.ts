import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { QueryKeys } from '@/constants/queryKeys';
import { bggClient } from '@/services/bgg/BggClient';
import { readBggPopularity } from '@/services/bgg/readBggPopularity';
import { rankSearchResults, type StoredPopularity } from '@/services/bgg/searchRank';

import { useCollection } from './useCollection';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Searches BoardGameGeek, then orders hits by popularity already stored on
 * shared game profiles and in the collection. The search itself is cached.
 * Ranking does not call BoardGameGeek again.
 */
export function useBggSearch(query: string) {
  const trimmed = query.trim();
  const search = useQuery({
    queryKey: QueryKeys.bgg.search(trimmed),
    queryFn: () => bggClient.search(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
  const { data: games = [] } = useCollection();
  const ids = (search.data ?? []).map((result) => result.bggId);
  const idKey = ids.join(',');
  const stored = useQuery({
    queryKey: QueryKeys.bgg.popularity(idKey),
    queryFn: () => readBggPopularity(ids),
    enabled: ids.length > 0,
    staleTime: DAY_MS,
  });

  const data = useMemo(() => {
    const popularity: Record<number, StoredPopularity> = { ...(stored.data ?? {}) };
    for (const game of games) {
      if (game.bggId === undefined) continue;
      const current = popularity[game.bggId] ?? {};
      const next: StoredPopularity = { ...current };
      if (next.bggRank === undefined && game.bggRank !== undefined) next.bggRank = game.bggRank;
      if (next.bggRating === undefined && game.bggRating !== undefined)
        next.bggRating = game.bggRating;
      if (
        next.bggRank !== undefined ||
        next.bggRating !== undefined ||
        next.usersRated !== undefined
      ) {
        popularity[game.bggId] = next;
      }
    }
    return rankSearchResults(search.data ?? [], popularity);
  }, [games, search.data, stored.data]);

  return { ...search, data };
}
