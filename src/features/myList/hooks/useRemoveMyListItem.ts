import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { MyListItemId } from '@/types';

import { firestoreMyListRepository } from '../api/FirestoreMyListRepository';

export function useRemoveMyListItem() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (itemId: MyListItemId) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreMyListRepository.remove(user.uid, itemId);
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
