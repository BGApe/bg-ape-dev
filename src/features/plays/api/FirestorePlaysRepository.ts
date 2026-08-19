import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { GameId, PlayId, UserId } from '@/types';

import { PlaySchema } from '../schemas';
import type { NewPlay, Play, PlayPatch } from '../types';

import type { PlaysRepository } from './PlaysRepository';

/** Loose input shape (optionals may be undefined) that toPlay normalizes. */
type RawPlay = {
  id: PlayId;
  userId: UserId;
  gameName: string;
  playedAt: number;
  createdAt: number;
  gameId?: GameId | undefined;
  location?: string | undefined;
  playerCount?: number | undefined;
  durationMinutes?: number | undefined;
  note?: string | undefined;
};

const USERS = 'users';
const PLAYS = 'plays';

function playsRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(PLAYS);
}

/** Drops keys whose value is undefined (Firestore rejects undefined values). */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/** Rebuilds a typed Play, omitting absent optionals (exactOptionalPropertyTypes). */
function toPlay(data: RawPlay): Play {
  const play: Play = {
    id: data.id,
    userId: data.userId,
    gameName: data.gameName,
    playedAt: data.playedAt,
    createdAt: data.createdAt,
  };
  if (data.gameId !== undefined) play.gameId = data.gameId;
  if (data.location !== undefined) play.location = data.location;
  if (data.playerCount !== undefined) play.playerCount = data.playerCount;
  if (data.durationMinutes !== undefined) play.durationMinutes = data.durationMinutes;
  if (data.note !== undefined) play.note = data.note;
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
        }),
      );
    }
    return plays;
  },

  async add(uid: UserId, play: NewPlay): Promise<Play> {
    const createdAt = Date.now();
    const ref = playsRef(uid).doc();
    const payload = compact({ ...play, userId: uid, createdAt });
    await ref.set(payload);
    return toPlay({ ...play, id: ref.id as PlayId, userId: uid, createdAt });
  },

  async update(uid: UserId, playId: PlayId, patch: PlayPatch): Promise<void> {
    await playsRef(uid)
      .doc(playId)
      .update(compact({ ...patch }));
  },

  async remove(uid: UserId, playId: PlayId): Promise<void> {
    await playsRef(uid).doc(playId).delete();
  },
};
