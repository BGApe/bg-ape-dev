import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';

import { chatRepository } from '../api/activeChatRepository';
import type { NewChatThread } from '../types';

export function useCreateThread() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (input: NewChatThread) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return chatRepository.createThread(user.uid, input);
    },

    onSuccess(_thread, input) {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.threads(user.uid) });
      firebaseAnalytics.track('conversation_created', { reason: input.reason });
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}
