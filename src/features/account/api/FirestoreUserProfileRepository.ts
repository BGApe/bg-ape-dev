import { firestore, serverTimestamp } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { UserId } from '@/types';

import { UserProfileSchema } from '../schemas';
import type { UpdateProfileInput, UserProfile } from '../types';

import type { UserProfileRepository } from './UserProfileRepository';

const COLLECTION = 'users';

export const firestoreUserProfileRepository: UserProfileRepository = {
  async get(uid: UserId): Promise<UserProfile | null> {
    const snap = await firestore().collection(COLLECTION).doc(uid).get();
    if (!snap.exists) return null;

    const raw = snap.data();
    const parsed = UserProfileSchema.safeParse({ ...raw, uid });
    if (!parsed.success) {
      logger.warn('[UserProfileRepo] Schema mismatch', { issues: parsed.error.issues });
      return null;
    }
    return parsed.data as UserProfile;
  },

  async createOrMerge(uid: UserId, data: Partial<UserProfile>): Promise<void> {
    const now = Date.now();
    await firestore()
      .collection(COLLECTION)
      .doc(uid)
      .set(
        {
          ...data,
          uid,
          createdAt: serverTimestamp(),
          updatedAt: now,
        },
        { merge: true },
      );
  },

  async update(uid: UserId, data: UpdateProfileInput): Promise<void> {
    await firestore()
      .collection(COLLECTION)
      .doc(uid)
      .update({ ...data, updatedAt: Date.now() });
  },
};
