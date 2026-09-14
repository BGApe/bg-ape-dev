import type { CollectionGame } from '@/features/collection/types';

/**
 * Curated BGG boardgamecategory / boardgamemechanic labels (exact API names).
 * Used by the game-picker intent filters so chips match stored CollectionGame tags.
 */
export const BGG_CATEGORY_OPTIONS = [
  'Abstract Strategy',
  'Adventure',
  'Bluffing',
  'Card Game',
  'Deduction',
  'Economic',
  'Fantasy',
  'Fighting',
  'Horror',
  'Medieval',
  'Negotiation',
  'Party Game',
  'Political',
  'Science Fiction',
  'Wargame',
] as const;

export const BGG_MECHANIC_OPTIONS = [
  'Area Majority / Influence',
  'Auction / Bidding',
  'Cooperative Game',
  'Deck, Bag, and Pool Building',
  'Dice Rolling',
  'Hand Management',
  'Network and Route Building',
  'Set Collection',
  'Tableau Building',
  'Tile Placement',
  'Worker Placement',
] as const;

const CURATED = new Set<string>([...BGG_CATEGORY_OPTIONS, ...BGG_MECHANIC_OPTIONS]);

/**
 * Chip list for the recommender: curated BGG tags first, then any extra tags
 * already present on the user's collection (so their shelf is always selectable).
 */
export function resolveGamePickerTags(games: CollectionGame[]): string[] {
  const fromCollection = new Set<string>();
  for (const game of games) {
    if (game.kind === 'expansion') continue;
    for (const t of game.categories ?? []) fromCollection.add(t);
    for (const t of game.mechanics ?? []) fromCollection.add(t);
  }

  const curated = [...CURATED];
  const extras = [...fromCollection]
    .filter((t) => !CURATED.has(t))
    .sort((a, b) => a.localeCompare(b));
  return [...curated, ...extras];
}
