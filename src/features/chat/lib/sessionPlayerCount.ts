import { detectPlayerCount } from '@/features/assistant/lib/collectionContext';

import type { ChatMessage, ChatThread } from '../types';

/** Same gaming session as a recent recommendation (e.g. pick a game → set it up). */
export const RECOMMENDATION_SESSION_MS = 2 * 60 * 60 * 1000;

type ResolveSessionPlayerCountArgs = {
  threads: ChatThread[];
  loadMessages: (thread: ChatThread) => Promise<ChatMessage[]>;
  /** When set, the game must appear in that recommendation thread (suggested game). */
  gameName: string;
  now?: number;
};

/**
 * Reuse player count from a recent recommendation query for the same game.
 * Looks at recommendation threads from the last 2 hours whose messages mention
 * `gameName`, and parses `We are N players.` from the user query.
 */
export async function resolveSessionPlayerCount(
  args: ResolveSessionPlayerCountArgs,
): Promise<string | undefined> {
  const now = args.now ?? Date.now();
  const gameName = args.gameName.trim().toLowerCase();
  if (!gameName) return undefined;

  const candidates = args.threads
    .filter((t) => t.reason === 'recommendation' && now - t.createdAt <= RECOMMENDATION_SESSION_MS)
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const thread of candidates) {
    const messages = await args.loadMessages(thread);
    const userMessages = messages.filter((m) => m.role === 'user');
    const queryMessage = userMessages[0];
    if (queryMessage === undefined) continue;
    if (now - queryMessage.createdAt > RECOMMENDATION_SESSION_MS) continue;

    const mentioned = messages.some((m) => m.content.toLowerCase().includes(gameName));
    if (!mentioned) continue;

    const fromQuery = detectPlayerCount(queryMessage.content);
    if (fromQuery !== undefined) return fromQuery;

    for (const m of userMessages) {
      const count = detectPlayerCount(m.content);
      if (count !== undefined) return count;
    }
  }

  return undefined;
}
