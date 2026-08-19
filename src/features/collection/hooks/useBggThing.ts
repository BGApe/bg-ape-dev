import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { bggClient } from '@/services/bgg/BggClient';

/** Fetches full BGG details for a game. Disabled when no bggId is available. */
export function useBggThing(bggId: number | undefined) {
  return useQuery({
    queryKey: bggId !== undefined ? QueryKeys.bgg.thing(bggId) : QueryKeys.bgg.thing(-1),
    queryFn: () => {
      if (bggId === undefined) return null;
      return bggClient.getThing(bggId);
    },
    enabled: bggId !== undefined,
    staleTime: 60 * 60 * 1000,
  });
}
