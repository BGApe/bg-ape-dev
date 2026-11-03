import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';

import { firestoreMyListRepository } from '../api/FirestoreMyListRepository';
import type { NewMyListItem } from '../types';

export function useAddMyListItem() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (item: NewMyListItem) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreMyListRepository.add(user.uid, item);
    },
    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.myList.list(user.uid) });
    },
    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
