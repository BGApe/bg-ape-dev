import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { ensureBggGameProfile, type EnsureBggGameProfileInput } from '@/services/bgg/gameProfile';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shared BoardGameGeek profile (metadata + stored rules FAQ).
 * Pass null to keep the query idle.
 */
export function useBggGameProfile(input: EnsureBggGameProfileInput | null) {
  const bggId = input?.bggId;
  const name = input?.name?.trim();
  const enabled = bggId !== undefined || (name !== undefined && name.length > 1);

  return useQuery({
    queryKey: QueryKeys.bgg.profile(bggId ?? name ?? ''),
    enabled,
    staleTime: DAY_MS,
    queryFn: () => {
      const request: EnsureBggGameProfileInput = {};
      if (bggId !== undefined) request.bggId = bggId;
      else if (name !== undefined) request.name = name;
      return ensureBggGameProfile(request);
    },
  });
}
