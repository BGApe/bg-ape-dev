import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { GameId, UserId } from '@/types';

import { CollectionGameSchema } from '../schemas';
import type { CollectionGame, CollectionGamePatch, GameSource, NewCollectionGame } from '../types';

import type { CollectionRepository } from './CollectionRepository';

/** Loose input shape (optionals may be undefined) that toGame normalizes. */
type RawGame = {
  id: GameId;
  name: string;
  source: GameSource;
  addedAt: number;
  bggId?: number | undefined;
  yearPublished?: number | undefined;
  thumbnailUrl?: string | undefined;
  language?: string | undefined;
  minPlayers?: number | undefined;
  maxPlayers?: number | undefined;
  playingTime?: number | undefined;
  averageWeight?: number | undefined;
  bggRating?: number | undefined;
  bggRank?: number | undefined;
  notes?: string | undefined;
};

const USERS = 'users';
const GAMES = 'games';

function gamesRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(GAMES);
}

/** Drops keys whose value is undefined (Firestore rejects undefined values). */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/** Rebuilds a typed CollectionGame, omitting absent optionals (exactOptionalPropertyTypes). */
function toGame(data: RawGame): CollectionGame {
  const game: CollectionGame = {
    id: data.id,
    name: data.name,
    source: data.source,
    addedAt: data.addedAt,
  };
  if (data.bggId !== undefined) game.bggId = data.bggId;
  if (data.yearPublished !== undefined) game.yearPublished = data.yearPublished;
  if (data.thumbnailUrl !== undefined) game.thumbnailUrl = data.thumbnailUrl;
  if (data.language !== undefined) game.language = data.language;
  if (data.minPlayers !== undefined) game.minPlayers = data.minPlayers;
  if (data.maxPlayers !== undefined) game.maxPlayers = data.maxPlayers;
  if (data.playingTime !== undefined) game.playingTime = data.playingTime;
  if (data.averageWeight !== undefined) game.averageWeight = data.averageWeight;
  if (data.bggRating !== undefined) game.bggRating = data.bggRating;
  if (data.bggRank !== undefined) game.bggRank = data.bggRank;
  if (data.notes !== undefined) game.notes = data.notes;
  return game;
}

export const firestoreCollectionRepository: CollectionRepository = {
  async list(uid: UserId): Promise<CollectionGame[]> {
    const snap = await gamesRef(uid).orderBy('addedAt', 'desc').get();

    const games: CollectionGame[] = [];
    for (const doc of snap.docs) {
      const parsed = CollectionGameSchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[CollectionRepo] Game schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      games.push(toGame({ ...parsed.data, id: parsed.data.id as GameId }));
    }
    return games;
  },

  async add(uid: UserId, game: NewCollectionGame): Promise<CollectionGame> {
    const addedAt = Date.now();
    const ref = gamesRef(uid).doc();
    const payload = compact({ ...game, addedAt });
    await ref.set(payload);
    return toGame({ ...game, id: ref.id as GameId, addedAt });
  },

  async update(uid: UserId, gameId: GameId, patch: CollectionGamePatch): Promise<void> {
    await gamesRef(uid)
      .doc(gameId)
      .update(compact({ ...patch }));
  },

  async remove(uid: UserId, gameId: GameId): Promise<void> {
    await gamesRef(uid).doc(gameId).delete();
  },
};
