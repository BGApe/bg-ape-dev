import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { GameId, LocationId, PlayId, PlayerId, UserId } from '@/types';

import { PlaySchema } from '../schemas';
import type { NewPlay, Play, PlayParticipant, PlayPatch } from '../types';

import type { PlaysRepository } from './PlaysRepository';

type RawParticipant = {
  playerId: PlayerId;
  name: string;
  score?: number | undefined;
  won: boolean;
};

type RawPlay = {
  id: PlayId;
  userId: UserId;
  gameName: string;
  playedAt: number;
  createdAt: number;
  gameId?: GameId | undefined;
  locationId?: LocationId | undefined;
  locationName?: string | undefined;
  location?: string | undefined;
  participants?: RawParticipant[] | undefined;
  playerCount?: number | undefined;
  durationMinutes?: number | undefined;
  note?: string | undefined;
  gameCategories?: string[] | undefined;
  gameMechanics?: string[] | undefined;
  gameWeight?: number | undefined;
};

const USERS = 'users';
const PLAYS = 'plays';

function playsRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(PLAYS);
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

function toParticipant(raw: RawParticipant): PlayParticipant {
  const p: PlayParticipant = { playerId: raw.playerId, name: raw.name, won: raw.won };
  if (raw.score !== undefined) p.score = raw.score;
  return p;
}

function toPlay(data: RawPlay): Play {
  const play: Play = {
    id: data.id,
    userId: data.userId,
    gameName: data.gameName,
    playedAt: data.playedAt,
    createdAt: data.createdAt,
  };
  if (data.gameId !== undefined) play.gameId = data.gameId;
  if (data.locationId !== undefined) play.locationId = data.locationId;
  if (data.locationName !== undefined) play.locationName = data.locationName;
  if (data.location !== undefined) play.location = data.location;
  if (data.participants !== undefined) play.participants = data.participants.map(toParticipant);
  if (data.playerCount !== undefined) play.playerCount = data.playerCount;
  if (data.durationMinutes !== undefined) play.durationMinutes = data.durationMinutes;
  if (data.note !== undefined) play.note = data.note;
  if (data.gameCategories !== undefined) play.gameCategories = data.gameCategories;
  if (data.gameMechanics !== undefined) play.gameMechanics = data.gameMechanics;
  if (data.gameWeight !== undefined) play.gameWeight = data.gameWeight;
  return play;
}

export const firestorePlaysRepository: PlaysRepository = {
  async list(uid: UserId): Promise<Play[]> {
    const snap = await playsRef(uid).orderBy('playedAt', 'desc').get();

    const plays: Play[] = [];
    for (const doc of snap.docs) {
      const parsed = PlaySchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[PlaysRepo] Play schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      plays.push(
        toPlay({
          ...parsed.data,
          id: parsed.data.id as PlayId,
          userId: parsed.data.userId as UserId,
          gameId: parsed.data.gameId as GameId | undefined,
          locationId: parsed.data.locationId as LocationId | undefined,
          participants: parsed.data.participants?.map((p) => ({
            ...p,
            playerId: p.playerId as PlayerId,
          })),
        }),
      );
    }
    return plays;
  },

  async add(uid: UserId, play: NewPlay): Promise<Play> {
    const createdAt = Date.now();
    const ref = playsRef(uid).doc();

    // Resolve NewPlayParticipant → PlayParticipant (playerId must be set by hook before reaching repo)
    const participants: PlayParticipant[] | undefined = play.participants?.map((p) => ({
      playerId: p.playerId as PlayerId,
      name: p.name,
      won: p.won,
      ...(p.score !== undefined ? { score: p.score } : {}),
    }));

    // playerCount: derive from participants if present, otherwise use explicit value
    const playerCount = participants !== undefined ? participants.length : play.playerCount;

    const payload = compact({
      ...play,
      participants,
      playerCount,
      userId: uid,
      createdAt,
    } as Record<string, unknown>);

    await ref.set(payload);
    return toPlay({
      ...play,
      participants,
      playerCount,
      id: ref.id as PlayId,
      userId: uid,
      createdAt,
    });
  },

  async update(uid: UserId, playId: PlayId, patch: PlayPatch): Promise<void> {
    await playsRef(uid)
      .doc(playId)
      .update(compact({ ...patch } as Record<string, unknown>));
  },

  async remove(uid: UserId, playId: PlayId): Promise<void> {
    await playsRef(uid).doc(playId).delete();
  },
};
