export type StoredPopularity = {
  /** Lower is more popular among ranked games. Missing rank sorts after any rank. */
  bggRank?: number;
  /** Average BGG score, 1–10. */
  bggRating?: number;
  /** How many people rated the game. */
  usersRated?: number;
};

const PROMO_NAME = /\bpromos?\b|promotional|alternate art|art pack|mini(?:ature)? pack|token pack/i;

/**
 * Puts widely played games and main expansions ahead of promo packs.
 * Popularity comes from stored profile fields. Names that are clearly promos
 * stay at the bottom even when those fields are missing.
 */
export function rankSearchResults<T extends { bggId: number; name: string }>(
  results: readonly T[],
  popularity: Readonly<Record<number, StoredPopularity>>,
): T[] {
  return results
    .map((result, index) => ({
      result,
      index,
      promo: PROMO_NAME.test(result.name) ? 1 : 0,
      users: popularity[result.bggId]?.usersRated ?? 0,
      rank: popularity[result.bggId]?.bggRank ?? Number.POSITIVE_INFINITY,
      rating: popularity[result.bggId]?.bggRating ?? 0,
    }))
    .sort((a, b) => {
      if (a.promo !== b.promo) return a.promo - b.promo;
      if (a.users !== b.users) return b.users - a.users;
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return a.index - b.index;
    })
    .map((item) => item.result);
}
