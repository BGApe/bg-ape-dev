import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { MyListItemId } from '@/types';

import { firestoreMyListRepository } from '../api/FirestoreMyListRepository';
import type { MyListItem, MyListItemPatch } from '../types';

export function useUpdateMyListItem() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (args: { itemId: MyListItemId; patch: MyListItemPatch }) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreMyListRepository.update(user.uid, args.itemId, args.patch);
    },
    onMutate: (args: { itemId: MyListItemId; patch: MyListItemPatch }) => {
      if (!user) return;
      const key = QueryKeys.myList.list(user.uid);
      const previous = queryClient.getQueryData<MyListItem[]>(key);
      queryClient.setQueryData<MyListItem[]>(key, (prev) =>
        (prev ?? []).map((item) => {
          if (item.id !== args.itemId) return item;
          const next = { ...item, ...args.patch };
          if (args.patch.note !== undefined && args.patch.note.trim().length === 0) {
            delete next.note;
          }
          return next;
        }),
      );
      return { previous, key };
    },
    onError(error, _args, context) {
      if (context?.previous !== undefined && context.key !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      logger.captureException(error, { mapped: mapError(error) });
    },
    onSettled() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.myList.list(user.uid) });
    },
  });
}
