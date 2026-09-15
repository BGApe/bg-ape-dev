import type { CollectionGame } from '@/features/collection/types';
import type { Play } from '@/features/plays/types';

import type {
  ActivityBias,
  CollectionContextLevel,
  CollectionGameContextItem,
  SetupDepth,
} from '../types';

const LEVEL_LIMITS: Record<
  CollectionContextLevel,
  { maxGames: number; maxTags: number; includeStats: boolean; includeMeta: boolean }
> = {
  minimal: { maxGames: 40, maxTags: 0, includeStats: false, includeMeta: false },
  optimal: { maxGames: 40, maxTags: 2, includeStats: true, includeMeta: true },
  maximal: { maxGames: 80, maxTags: 6, includeStats: true, includeMeta: true },
};

/** Tag budget for a single focused game (setup/rules) — matches CF parse slice. */
const GAME_CONTEXT_MAX_TAGS = 8;

/** Default production level — see cost analysis in chat for min/max trade-offs. */
export const DEFAULT_COLLECTION_CONTEXT_LEVEL: CollectionContextLevel = 'optimal';

type PlayAgg = {
  playCount: number;
  lastPlayedAt: number | undefined;
};

function aggregatePlays(plays: Play[]): Map<string, PlayAgg> {
  const byGame = new Map<string, PlayAgg>();
  for (const play of plays) {
    if (!play.gameId) continue;
    const prev = byGame.get(play.gameId);
    if (!prev) {
      byGame.set(play.gameId, { playCount: 1, lastPlayedAt: play.playedAt });
      continue;
    }
    prev.playCount += 1;
    if (prev.lastPlayedAt === undefined || play.playedAt > prev.lastPlayedAt) {
      prev.lastPlayedAt = play.playedAt;
    }
  }
  return byGame;
}

function daysSince(ts: number | undefined, now: number): number | null {
  if (ts === undefined) return null;
  return Math.max(0, Math.floor((now - ts) / 86_400_000));
}

/**
 * Builds a compact collection snapshot for the assistant.
 * Expansions are omitted — recommendations target base games.
 */
export function buildCollectionContext(
  games: CollectionGame[],
  plays: Play[],
  level: CollectionContextLevel = DEFAULT_COLLECTION_CONTEXT_LEVEL,
  now: number = Date.now(),
): CollectionGameContextItem[] {
  const limits = LEVEL_LIMITS[level];
  const playAgg = aggregatePlays(plays);

  const baseGames = games.filter((g) => g.kind !== 'expansion');

  const items: CollectionGameContextItem[] = baseGames.map((game) => {
    const agg = playAgg.get(game.id);
    const item: CollectionGameContextItem = { name: game.name };

    if (limits.includeMeta) {
      if (game.minPlayers !== undefined) item.minPlayers = game.minPlayers;
      if (game.maxPlayers !== undefined) item.maxPlayers = game.maxPlayers;
      if (game.playingTime !== undefined) item.playingTime = game.playingTime;
      if (game.averageWeight !== undefined) {
        item.averageWeight = Math.round(game.averageWeight * 10) / 10;
      }
      if (limits.maxTags > 0) {
        const mechanics = (game.mechanics ?? []).slice(0, limits.maxTags);
        const categories = (game.categories ?? []).slice(0, limits.maxTags);
        if (mechanics.length > 0) item.mechanics = mechanics;
        if (categories.length > 0) item.categories = categories;
      }
    }

    if (limits.includeStats) {
      item.playCount = agg?.playCount ?? 0;
      const days = daysSince(agg?.lastPlayedAt, now);
      if (days !== null) item.daysSinceLastPlay = days;
    }

    return item;
  });

  // Prefer games with play history, then alphabetical — keeps familiar shelf first under the cap.
  items.sort((a, b) => {
    const playDiff = (b.playCount ?? 0) - (a.playCount ?? 0);
    if (playDiff !== 0) return playDiff;
    return a.name.localeCompare(b.name);
  });

  return items.slice(0, limits.maxGames);
}

/**
 * Compact single-game snapshot for setup/rules.
 * Includes metadata only — no play stats. Returns null when the game is an expansion.
 */
export function buildGameContext(game: CollectionGame): CollectionGameContextItem | null {
  if (game.kind === 'expansion') return null;

  const item: CollectionGameContextItem = { name: game.name };

  if (game.minPlayers !== undefined) item.minPlayers = game.minPlayers;
  if (game.maxPlayers !== undefined) item.maxPlayers = game.maxPlayers;
  if (game.playingTime !== undefined) item.playingTime = game.playingTime;
  if (game.averageWeight !== undefined) {
    item.averageWeight = Math.round(game.averageWeight * 10) / 10;
  }

  const mechanics = (game.mechanics ?? []).slice(0, GAME_CONTEXT_MAX_TAGS);
  const categories = (game.categories ?? []).slice(0, GAME_CONTEXT_MAX_TAGS);
  if (mechanics.length > 0) item.mechanics = mechanics;
  if (categories.length > 0) item.categories = categories;

  return item;
}

/** Rough token estimate (~4 chars/token) for cost planning. */
export function estimateCollectionContextTokens(items: CollectionGameContextItem[]): number {
  return Math.ceil(formatCollectionContextBlock(items).length / 4);
}

/** Recover activity bias from prompt text (intent screen encodes it in the first message). */
export function detectActivityBias(text: string): ActivityBias {
  const t = text.toLowerCase();
  if (t.includes('less often') || t.includes('fresh picks')) {
    return 'undereplayed';
  }
  if (t.includes('frequently played favorites')) {
    return 'favorites';
  }
  if (t.includes('played recently') && t.includes('prefer games we')) {
    return 'recent';
  }
  return 'none';
}

/**
 * Recover setup depth from prompt text (Quick setup encodes it via depth option phrases).
 * Returns undefined when no depth phrase is present — callers default to `'basic'`.
 */
export function detectSetupDepth(text: string): SetupDepth | undefined {
  const t = text.toLowerCase();
  if (t.includes('just enough to start playing right now')) return 'quick';
  if (t.includes('complete rules walkthrough')) return 'full';
  if (t.includes('understand the basics') || t.includes('core rules')) return 'basic';
  return undefined;
}

/**
 * Recover player-count chip id from intent prompt text.
 * Matches game-picker (`We are N players.`) and legacy setup (`We'll be N players.`).
 */
export function detectPlayerCount(text: string): string | undefined {
  const match = text.match(/\b(?:we are|we'll be)\s+(\d\+|\d+)\s+players\./i);
  return match?.[1];
}

/**
 * Human-readable block appended to the model user turn.
 * Kept compact so all three levels stay within a predictable budget.
 */
export function formatCollectionContextBlock(
  items: CollectionGameContextItem[],
  activityBias: ActivityBias = 'none',
): string {
  if (items.length === 0) return '';

  const lines = items.map((g) => {
    const bits: string[] = [g.name];
    if (g.minPlayers !== undefined || g.maxPlayers !== undefined) {
      const min = g.minPlayers ?? '?';
      const max = g.maxPlayers ?? '?';
      bits.push(`${min}–${max}p`);
    }
    if (g.playingTime !== undefined) bits.push(`${g.playingTime}m`);
    if (g.averageWeight !== undefined) bits.push(`w${g.averageWeight}`);
    const tags = [...(g.mechanics ?? []), ...(g.categories ?? [])];
    if (tags.length > 0) bits.push(tags.join('/'));
    if (g.playCount !== undefined) {
      const last =
        g.daysSinceLastPlay === undefined
          ? 'never'
          : g.daysSinceLastPlay === 0
            ? 'today'
            : `${g.daysSinceLastPlay}d`;
      bits.push(`plays:${g.playCount},last:${last}`);
    }
    return `- ${bits.join(' · ')}`;
  });

  const biasLine =
    activityBias === 'undereplayed'
      ? 'Activity preference: prefer underexposed / less-played games.'
      : activityBias === 'favorites'
        ? 'Activity preference: prefer frequently played favorites.'
        : activityBias === 'recent'
          ? 'Activity preference: prefer games played recently.'
          : null;

  return [
    `User collection (${items.length} base games):`,
    ...lines,
    ...(biasLine ? [biasLine] : []),
  ].join('\n');
}
