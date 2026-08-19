/** A lightweight search hit from BGG's /search endpoint. */
export type BggSearchResult = {
  bggId: number;
  name: string;
  yearPublished?: number;
};

/** Full game details from BGG's /thing endpoint (stats=1). */
export type BggThing = {
  bggId: number;
  name: string;
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
  /** Overall BoardGameGeek rank (lower is better); undefined if unranked. */
  bggRank?: number;
  description?: string;
};
