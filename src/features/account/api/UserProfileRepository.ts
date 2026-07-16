import type { UserId } from '@/types';

import type { UpdateProfileInput, UserProfile } from '../types';

/**
 * User profile repository interface.
 * FirestoreUserProfileRepository is the only implementation for now.
 * A future MockUserProfileRepository can be used in tests.
 */
export interface UserProfileRepository {
  get(uid: UserId): Promise<UserProfile | null>;
  /** Creates the profile if it doesn't exist; merges if it does. Idempotent. */
  createOrMerge(uid: UserId, data: Partial<UserProfile>): Promise<void>;
  update(uid: UserId, data: UpdateProfileInput): Promise<void>;
}
