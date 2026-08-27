import type { GameId, LocationId, PlayId, PlayerId, UserId } from '@/types';

/**
 * A single participant in a play session.
 * `playerId` references the player profile; `name` is denormalized so the
 * play stays readable even if the profile is later deleted.
 */
export type PlayParticipant = {
  playerId: PlayerId;
  /** Denormalized display name. */
  name: string;
  score?: number;
  won: boolean;
};

/**
 * Input shape for a participant when logging a play.
 * If `playerId` is absent the hook will find-or-create a player profile by name.
 */
export type NewPlayParticipant = {
  playerId?: PlayerId;
  name: string;
  score?: number;
  won: boolean;
};

/**
 * A logged play session. Stored at users/{uid}/plays/{playId}.
 * Only `gameName` + `playedAt` are required; everything else is optional.
 *
 * Backward-compat: older plays may have `location` (string) and `playerCount`
 * instead of the newer `locationId`/`locationName`/`participants` fields.
 */
export type Play = {
  id: PlayId;
  userId: UserId;
  gameName: string;
  gameId?: GameId;
  playedAt: number;
  /** Reference to the location profile. */
  locationId?: LocationId;
  /** Denormalized location name (display without extra fetch). */
  locationName?: string;
  /** Legacy free-text location (kept for backward compat). */
  location?: string;
  /** Structured participant list (replaces playerCount for new plays). */
  participants?: PlayParticipant[];
  /** Legacy player count (kept for backward compat; derived from participants.length when present). */
  playerCount?: number;
  durationMinutes?: number;
  note?: string;
  /**
   * Game metadata snapshot — denormalized from the collection at write time.
   * Enables filtering plays by category/mechanic/weight without a client-side join.
   * Absent for manually-entered games or games without BGG enrichment.
   */
  gameCategories?: string[];
  gameMechanics?: string[];
  gameWeight?: number;
  createdAt: number;
};

export type NewPlay = {
  gameName: string;
  gameId?: GameId;
  playedAt: number;
  locationId?: LocationId;
  locationName?: string;
  location?: string;
  participants?: NewPlayParticipant[];
  playerCount?: number;
  durationMinutes?: number;
  note?: string;
  gameCategories?: string[];
  gameMechanics?: string[];
  gameWeight?: number;
};

export type PlayPatch = {
  gameName?: string;
  playedAt?: number;
  locationId?: LocationId;
  locationName?: string;
  location?: string;
  participants?: PlayParticipant[];
  playerCount?: number;
  durationMinutes?: number;
  note?: string;
};
