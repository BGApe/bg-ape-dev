import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { LocationId, UserId } from '@/types';

import { LocationSchema } from '../schemas';
import type { Location, LocationPatch, NewLocation } from '../types';

import type { LocationsRepository } from './LocationsRepository';

type RawLocation = {
  id: LocationId;
  userId: UserId;
  name: string;
  createdAt: number;
};

const USERS = 'users';
const LOCATIONS = 'locations';

function locationsRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(LOCATIONS);
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

function toLocation(data: RawLocation): Location {
  return {
    id: data.id,
    userId: data.userId,
    name: data.name,
    createdAt: data.createdAt,
  };
}

export const firestoreLocationsRepository: LocationsRepository = {
  async list(uid: UserId): Promise<Location[]> {
    const snap = await locationsRef(uid).orderBy('name').get();
    const locations: Location[] = [];
    for (const doc of snap.docs) {
      const parsed = LocationSchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[LocationsRepo] Location schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      locations.push(
        toLocation({
          ...parsed.data,
          id: parsed.data.id as LocationId,
          userId: parsed.data.userId as UserId,
        }),
      );
    }
    return locations;
  },

  async add(uid: UserId, location: NewLocation): Promise<Location> {
    const createdAt = Date.now();
    const ref = locationsRef(uid).doc();
    await ref.set(compact({ ...location, userId: uid, createdAt }));
    return toLocation({ ...location, id: ref.id as LocationId, userId: uid, createdAt });
  },

  async update(uid: UserId, locationId: LocationId, patch: LocationPatch): Promise<void> {
    await locationsRef(uid)
      .doc(locationId)
      .update(compact({ ...patch }));
  },

  async remove(uid: UserId, locationId: LocationId): Promise<void> {
    await locationsRef(uid).doc(locationId).delete();
  },
};
