import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { PlayerId, UserId } from '@/types';

import { PlayerSchema } from '../schemas';
import type { NewPlayer, Player, PlayerPatch } from '../types';

import type { PlayersRepository } from './PlayersRepository';

type RawPlayer = {
  id: PlayerId;
  userId: UserId;
  name: string;
  nickname?: string | undefined;
  createdAt: number;
};

const USERS = 'users';
const PLAYERS = 'players';

function playersRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(PLAYERS);
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

function toPlayer(data: RawPlayer): Player {
  const player: Player = {
    id: data.id,
    userId: data.userId,
    name: data.name,
    createdAt: data.createdAt,
  };
  if (data.nickname !== undefined) player.nickname = data.nickname;
  return player;
}

export const firestorePlayersRepository: PlayersRepository = {
  async list(uid: UserId): Promise<Player[]> {
    const snap = await playersRef(uid).orderBy('name').get();
    const players: Player[] = [];
    for (const doc of snap.docs) {
      const parsed = PlayerSchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[PlayersRepo] Player schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      players.push(
        toPlayer({
          ...parsed.data,
          id: parsed.data.id as PlayerId,
          userId: parsed.data.userId as UserId,
        }),
      );
    }
    return players;
  },

  async add(uid: UserId, player: NewPlayer): Promise<Player> {
    const createdAt = Date.now();
    const ref = playersRef(uid).doc();
    await ref.set(compact({ ...player, userId: uid, createdAt }));
    return toPlayer({ ...player, id: ref.id as PlayerId, userId: uid, createdAt });
  },

  async update(uid: UserId, playerId: PlayerId, patch: PlayerPatch): Promise<void> {
    await playersRef(uid)
      .doc(playerId)
      .update(compact({ ...patch }));
  },

  async remove(uid: UserId, playerId: PlayerId): Promise<void> {
    await playersRef(uid).doc(playerId).delete();
  },
};
