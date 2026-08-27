import type { LocationId, UserId } from '@/types';

/**
 * A reusable location profile. Stored at users/{uid}/locations/{locationId}.
 * Referenced by plays (denormalized name keeps plays readable even if the
 * profile is later deleted).
 */
export type Location = {
  id: LocationId;
  userId: UserId;
  name: string;
  createdAt: number;
};

export type NewLocation = {
  name: string;
};

export type LocationPatch = {
  name?: string;
};
