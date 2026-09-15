import type { BarDatum } from '@/components/BarChart';
import type { CollectionGame } from '@/features/collection/types';
import type { Play } from '@/features/plays/types';
import type { GameId, PlayerId } from '@/types';

export type ChartMetric = 'plays' | 'playtime' | 'winrate';

export type GamePlayStats = {
  playCount: number;
  wins: number;
  lastPlayedAt: number | undefined;
};

/** Aggregates play/win/last-played stats for one game for the self player. */
export function statsForGame(
  plays: Play[],
  gameId: GameId,
  selfPlayerId: PlayerId | undefined,
): GamePlayStats {
  let playCount = 0;
  let wins = 0;
  let lastPlayedAt: number | undefined;

  for (const play of plays) {
    if (play.gameId !== gameId) continue;
    playCount += 1;
    if (lastPlayedAt === undefined || play.playedAt > lastPlayedAt) {
      lastPlayedAt = play.playedAt;
    }
    if (selfPlayerId !== undefined && play.participants !== undefined) {
      if (play.participants.some((p) => p.playerId === selfPlayerId && p.won)) {
        wins += 1;
      }
    }
  }

  return { playCount, wins, lastPlayedAt };
}

/** Builds a map of gameId → stats for the whole collection. */
export function statsByGameId(
  plays: Play[],
  games: CollectionGame[],
  selfPlayerId: PlayerId | undefined,
): Map<GameId, GamePlayStats> {
  const map = new Map<GameId, GamePlayStats>();
  for (const game of games) {
    map.set(game.id, statsForGame(plays, game.id, selfPlayerId));
  }
  return map;
}

/** Relative “last play” label, e.g. “3d ago”, “2mo ago”, or dash. */
export function formatLastPlayRelative(lastPlayedAt: number | undefined, dash: string): string {
  if (lastPlayedAt === undefined) return dash;
  const diffMs = Date.now() - lastPlayedAt;
  const dayMs = 86_400_000;
  const days = Math.floor(diffMs / dayMs);
  if (days < 1) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1mo ago';
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1y ago' : `${years}y ago`;
}

/** Up to 4 distinguishing tags: mechanics first, then categories. */
export function gameTags(game: CollectionGame, max = 4): string[] {
  const tags: string[] = [];
  for (const m of game.mechanics ?? []) {
    if (tags.length >= max) break;
    if (!tags.includes(m)) tags.push(m);
  }
  for (const c of game.categories ?? []) {
    if (tags.length >= max) break;
    if (!tags.includes(c)) tags.push(c);
  }
  return tags;
}

/**
 * Builds a bar chart dataset for a single game across the last `months` calendar months.
 *
 * - **plays** – play count per month
 * - **playtime** – total `durationMinutes` per month (missing values counted as 0)
 * - **winrate** – percentage of plays where `selfPlayerId` won (0–100), 0 when unknown
 */
export function buildChart(
  plays: Play[],
  gameId: GameId,
  metric: ChartMetric,
  months: number,
  selfPlayerId?: PlayerId,
): BarDatum[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const periodPlays = plays.filter(
      (p) => p.gameId === gameId && p.playedAt >= start && p.playedAt < end,
    );

    let value = 0;
    if (metric === 'plays') {
      value = periodPlays.length;
    } else if (metric === 'playtime') {
      value = periodPlays.reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0);
    } else {
      // winrate
      if (selfPlayerId !== undefined && periodPlays.length > 0) {
        const wins = periodPlays.filter((p) =>
          p.participants?.some((part) => part.playerId === selfPlayerId && part.won),
        ).length;
        value = Math.round((wins / periodPlays.length) * 100);
      }
    }

    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      value,
    };
  });
}
