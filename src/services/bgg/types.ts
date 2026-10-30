/** A lightweight search hit from BGG's /search endpoint. */
export type BggSearchResult = {
  bggId: number;
  name: string;
  yearPublished?: number;
};

export type BggThingKind = 'boardgame' | 'boardgameexpansion' | 'other';

/** Full game details from BGG's /thing endpoint (stats=1). */
export type BggThing = {
  bggId: number;
  name: string;
  kind: BggThingKind;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  thumbnailUrl?: string;
  imageUrl?: string;
  /** BGG "weight" (complexity), 1–5. */
  averageWeight?: number;
  /** Average user rating, 1–10. */
  bggRating?: number;
  /** How many people rated the game. A stored stand-in for how widely it is played. */
  usersRated?: number;
  /** Overall BoardGameGeek rank (lower is better); undefined if unranked. */
  bggRank?: number;
  description?: string;
  /** BGG boardgamecategory labels, e.g. ["Fantasy", "Fighting"]. */
  categories?: string[];
  /** BGG boardgamemechanic labels, e.g. ["Deck Building", "Co-operative Play"]. */
  mechanics?: string[];
  /** Parent base-game BGG id when this thing is an expansion. */
  parentBggId?: number;
  /** Number of expansion links listed on a base game. */
  expansionCount?: number;
  /** Expansion stubs linked from a base game (id + name). */
  expansions?: { bggId: number; name: string }[];
};
