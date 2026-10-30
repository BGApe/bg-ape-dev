import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { ThreadId } from '@/types';

import { chatRepository } from '../api/activeChatRepository';
import { applyThreadPatch } from '../lib/threadPatch';
import type { ChatThread, ChatThreadPatch } from '../types';

export function useUpdateThread() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (args: { threadId: ThreadId; patch: ChatThreadPatch }) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return chatRepository.updateThread(user.uid, args.threadId, args.patch);
    },

    onSuccess(_void, args) {
      if (!user) return;
      queryClient.setQueryData<ChatThread[]>(QueryKeys.chat.threads(user.uid), (prev) =>
        (prev ?? []).map((thread) =>
          thread.id === args.threadId ? applyThreadPatch(thread, args.patch) : thread,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.threads(user.uid) });
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
