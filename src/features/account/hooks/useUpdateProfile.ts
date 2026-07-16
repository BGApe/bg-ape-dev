import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { mapError } from '@/lib/mapError';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';

import { firestoreUserProfileRepository } from '../api/FirestoreUserProfileRepository';
import type { UpdateProfileInput } from '../types';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: (data: UpdateProfileInput) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      return firestoreUserProfileRepository.update(user.uid, data);
    },

    onSuccess() {
      if (user) {
        void queryClient.invalidateQueries({
          queryKey: QueryKeys.user.profile(user.uid),
        });
        firebaseAnalytics.track('profile_updated');
      }
    },

    onError(error) {
      const mapped = mapError(error);
      logger.captureException(error, { mapped });
    },
  });
}
