import type { GameId, UserId } from '@/types';

import type { CollectionGame, CollectionGamePatch, NewCollectionGame } from '../types';

export interface CollectionRepository {
  list(uid: UserId): Promise<CollectionGame[]>;
  add(uid: UserId, game: NewCollectionGame): Promise<CollectionGame>;
  update(uid: UserId, gameId: GameId, patch: CollectionGamePatch): Promise<void>;
  remove(uid: UserId, gameId: GameId): Promise<void>;
}
