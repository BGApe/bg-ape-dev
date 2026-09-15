import type { CollectionGame } from '../types';

export type CollectionSort = 'name' | 'mostPlayed' | 'leastPlayed' | 'lastPlayed';

export type CollectionFilters = {
  nameQuery: string;
  playerCount: string | undefined;
  complexity: 'Low' | 'Medium' | 'High' | undefined;
  playTime: string | undefined;
  tag: string | undefined;
  showExpansions: boolean;
};

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  nameQuery: '',
  playerCount: undefined,
  complexity: undefined,
  playTime: undefined,
  tag: undefined,
  showExpansions: false,
};

function matchesPlayerCount(game: CollectionGame, countStr: string): boolean {
  const n = Number(countStr.replace('+', ''));
  if (!Number.isFinite(n)) return true;
  const min = game.minPlayers ?? 1;
  const max = game.maxPlayers ?? 99;
  if (countStr.endsWith('+')) return max >= n;
  return min <= n && max >= n;
}

function matchesComplexity(game: CollectionGame, complexity: 'Low' | 'Medium' | 'High'): boolean {
  const w = game.averageWeight;
  if (w === undefined) return false;
  if (complexity === 'Low') return w < 2;
  if (complexity === 'Medium') return w >= 2 && w <= 3.2;
  return w > 3.2;
}

function matchesPlayTime(game: CollectionGame, playTime: string): boolean {
  const t = game.playingTime;
  if (t === undefined) return false;
  if (playTime === '120+') return t >= 120;
  const target = Number(playTime);
  if (!Number.isFinite(target)) return true;
  // Match within a reasonable band around the selected bracket
  if (target <= 15) return t <= 20;
  if (target <= 30) return t > 20 && t <= 45;
  if (target <= 60) return t > 45 && t <= 90;
  return t > 90 && t < 120;
}

function matchesTag(game: CollectionGame, tag: string): boolean {
  const needle = tag.toLowerCase();
  const hay = [...(game.mechanics ?? []), ...(game.categories ?? [])].map((s) => s.toLowerCase());
  return hay.some((h) => h.includes(needle) || needle.includes(h));
}

export function filterCollectionGames(
  games: CollectionGame[],
  filters: CollectionFilters,
): CollectionGame[] {
  return games.filter((game) => {
    if (!filters.showExpansions && game.kind === 'expansion') return false;

    const q = filters.nameQuery.trim().toLowerCase();
    if (q.length > 0 && !game.name.toLowerCase().includes(q)) return false;

    if (filters.playerCount !== undefined && !matchesPlayerCount(game, filters.playerCount)) {
      return false;
    }
    if (filters.complexity !== undefined && !matchesComplexity(game, filters.complexity)) {
      return false;
    }
    if (filters.playTime !== undefined && !matchesPlayTime(game, filters.playTime)) {
      return false;
    }
    if (filters.tag !== undefined && !matchesTag(game, filters.tag)) return false;

    return true;
  });
}

export function sortCollectionGames(
  games: CollectionGame[],
  sort: CollectionSort,
  playCount: (id: string) => number,
  lastPlayedAt: (id: string) => number | undefined,
): CollectionGame[] {
  const sorted = [...games];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'mostPlayed':
        return playCount(b.id) - playCount(a.id) || a.name.localeCompare(b.name);
      case 'leastPlayed':
        return playCount(a.id) - playCount(b.id) || a.name.localeCompare(b.name);
      case 'lastPlayed': {
        const la = lastPlayedAt(a.id) ?? 0;
        const lb = lastPlayedAt(b.id) ?? 0;
        return lb - la || a.name.localeCompare(b.name);
      }
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });
  return sorted;
}
