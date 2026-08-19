import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { bggClient } from '@/services/bgg/BggClient';

/**
 * Searches BoardGameGeek. Pass an already-debounced query from the caller;
 * disabled below 2 characters. Results are cached briefly to avoid re-querying
 * BGG for the same term.
 */
export function useBggSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: QueryKeys.bgg.search(trimmed),
    queryFn: () => bggClient.search(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
