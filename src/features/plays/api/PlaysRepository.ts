import type { PlayId, UserId } from '@/types';

import type { NewPlay, Play, PlayPatch } from '../types';

/** Play-log persistence. Plays live at users/{uid}/plays/{playId}. */
export interface PlaysRepository {
  list(uid: UserId): Promise<Play[]>;
  add(uid: UserId, play: NewPlay): Promise<Play>;
  update(uid: UserId, playId: PlayId, patch: PlayPatch): Promise<void>;
  remove(uid: UserId, playId: PlayId): Promise<void>;
}
