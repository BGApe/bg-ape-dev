import type { PlayerId, UserId } from '@/types';

import type { NewPlayer, Player, PlayerPatch } from '../types';

/** Player-profile persistence. Profiles live at users/{uid}/players/{playerId}. */
export interface PlayersRepository {
  list(uid: UserId): Promise<Player[]>;
  add(uid: UserId, player: NewPlayer): Promise<Player>;
  update(uid: UserId, playerId: PlayerId, patch: PlayerPatch): Promise<void>;
  remove(uid: UserId, playerId: PlayerId): Promise<void>;
}
