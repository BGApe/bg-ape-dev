import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { ThreadId } from '@/types';

import { chatRepository } from '../api/activeChatRepository';
import type { ChatThreadPatch } from '../types';

export function useUpdateThread() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (args: { threadId: ThreadId; patch: ChatThreadPatch }) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return chatRepository.updateThread(user.uid, args.threadId, args.patch);
    },

    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.threads(user.uid) });
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
