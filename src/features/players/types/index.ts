import type { PlayerId, UserId } from '@/types';

/**
 * A reusable player profile. Stored at users/{uid}/players/{playerId}.
 * Referenced by PlayParticipant inside each play record (denormalized name
 * keeps plays readable even if the profile is later deleted).
 */
export type Player = {
  id: PlayerId;
  userId: UserId;
  name: string;
  /** Optional gaming nickname shown in stats. */
  nickname?: string;
  createdAt: number;
};

export type NewPlayer = {
  name: string;
  nickname?: string;
};

export type PlayerPatch = {
  name?: string;
  nickname?: string;
};
