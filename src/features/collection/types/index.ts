import type { GameId } from '@/types';

/** How a game entered the collection. */
export type GameSource = 'manual' | 'scanner' | 'bgg';

/** Base game vs expansion (alternate editions stay `base`). */
export type GameKind = 'base' | 'expansion';

/**
 * A board game in the user's collection.
 * Stored at users/{uid}/games/{gameId}. Optional fields are populated when a
 * game is added via the BoardGameGeek lookup (scanner or manual search).
 */
export type CollectionGame = {
  id: GameId;
  name: string;
  source: GameSource;
  addedAt: number;
  /** Base game vs expansion. Defaults to `base` for legacy docs. */
  kind: GameKind;
  /** BoardGameGeek thing id, when matched. */
  bggId?: number;
  /** Parent base-game BGG id when `kind === 'expansion'`. */
  parentBggId?: number;
  /** Total expansions listed on BGG for this base game (at last fetch). */
  bggExpansionCount?: number;
  yearPublished?: number;
  thumbnailUrl?: string;
  /** Edition/box language, e.g. 'English', 'German'. */
  language?: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  /** BGG "weight" (complexity), 1–5. */
  averageWeight?: number;
  /** Average BGG user rating, 1–10. */
  bggRating?: number;
  /** Overall BoardGameGeek rank (lower is better). */
  bggRank?: number;
  /** User's custom notes about the game (editable on the detail screen). */
  notes?: string;
  /** BGG category labels, e.g. ["Fantasy", "Fighting"]. */
  categories?: string[];
  /** BGG mechanic labels, e.g. ["Deck Building", "Co-operative Play"]. */
  mechanics?: string[];
};

/** Fields a caller provides when adding a game; id/addedAt are assigned by the repo. */
export type NewCollectionGame = Omit<CollectionGame, 'id' | 'addedAt'>;

/** Mutable fields (e.g. editing custom notes or BGG enrichment backfill). */
export type CollectionGamePatch = {
  notes?: string;
  yearPublished?: number;
  thumbnailUrl?: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  averageWeight?: number;
  bggRating?: number;
  bggRank?: number;
  categories?: string[];
  mechanics?: string[];
  bggId?: number;
  source?: GameSource;
  kind?: GameKind;
  parentBggId?: number;
  bggExpansionCount?: number;
};
