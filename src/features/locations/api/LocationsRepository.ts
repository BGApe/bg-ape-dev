import type { LocationId, UserId } from '@/types';

import type { Location, LocationPatch, NewLocation } from '../types';

/** Location-profile persistence. Profiles live at users/{uid}/locations/{locationId}. */
export interface LocationsRepository {
  list(uid: UserId): Promise<Location[]>;
  add(uid: UserId, location: NewLocation): Promise<Location>;
  update(uid: UserId, locationId: LocationId, patch: LocationPatch): Promise<void>;
  remove(uid: UserId, locationId: LocationId): Promise<void>;
}
