import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';

import { firestoreLocationsRepository } from '../api/FirestoreLocationsRepository';
import type { NewLocation } from '../types';

export function useCreateLocation() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (location: NewLocation) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreLocationsRepository.add(user.uid, location);
    },
    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.locations.list(user.uid) });
    },
    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
