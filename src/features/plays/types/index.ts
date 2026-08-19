import type { GameId, PlayId, UserId } from '@/types';

/**
 * A logged play session. Stored at users/{uid}/plays/{playId}.
 * Only game + date are required; everything else is optional metadata.
 * `note` is editable inline in the plays list.
 */
export type Play = {
  id: PlayId;
  userId: UserId;
  gameName: string;
  /** Set when the game was picked from the collection; absent for free-text entries. */
  gameId?: GameId;
  /** Epoch ms for the day the game was played. */
  playedAt: number;
  location?: string;
  playerCount?: number;
  durationMinutes?: number;
  note?: string;
  createdAt: number;
};

/** Fields a caller provides when logging a play; id/createdAt are assigned by the repo. */
export type NewPlay = {
  gameName: string;
  gameId?: GameId;
  playedAt: number;
  location?: string;
  playerCount?: number;
  durationMinutes?: number;
  note?: string;
};

/** Mutable play fields (e.g. inline note editing). */
export type PlayPatch = {
  gameName?: string;
  playedAt?: number;
  location?: string;
  playerCount?: number;
  durationMinutes?: number;
  note?: string;
};
