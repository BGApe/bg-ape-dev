import { firestore } from '@/backend/firestore';

import type { StoredPopularity } from './searchRank';

function positive(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return undefined;
  return number;
}

/** Reads rank, score, and rating count already stored on shared game profiles. */
export async function readBggPopularity(
  bggIds: readonly number[],
): Promise<Record<number, StoredPopularity>> {
  const ids = [...new Set(bggIds.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 40);
  const found: Record<number, StoredPopularity> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await firestore().collection('bggGames').doc(String(id)).get();
        if (!snap.exists) return;
        const data = snap.data() ?? {};
        const entry: StoredPopularity = {};
        const rank = positive(data['bggRank']);
        const rating = positive(data['bggRating']);
        const users = positive(data['usersRated']);
        if (rank !== undefined) entry.bggRank = Math.round(rank);
        if (rating !== undefined) entry.bggRating = rating;
        if (users !== undefined) entry.usersRated = Math.round(users);
        if (
          entry.bggRank !== undefined ||
          entry.bggRating !== undefined ||
          entry.usersRated !== undefined
        ) {
          found[id] = entry;
        }
      } catch {
        // A missing or unreadable profile just leaves this hit unranked.
      }
    }),
  );
  return found;
}
