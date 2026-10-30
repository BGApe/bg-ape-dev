import type { CollectionGame } from '@/features/collection/types';
import type { GameId } from '@/types';

import type { ChatThread, DiscussionKind } from '../types';

export type GameAnchor = {
  key: string;
  gameName: string;
  versionName: string;
  gameId?: GameId;
};

export function discussionHeading(
  versionName: string,
  kind: DiscussionKind,
  playerCount?: string,
): string {
  if (kind === 'rules') return `${versionName}: Rules help`;
  const players =
    playerCount !== undefined && playerCount.length > 0 ? ` (for ${playerCount} players)` : '';
  return `${versionName}: Quick setup${players}`;
}

/** Name of the first collapsed block, taken from the depth or topic in the prompt. */
export function openingTopicTitle(kind: DiscussionKind, prompt: string): string {
  if (kind === 'setup') {
    if (prompt.includes('5 minutes')) return '5 minute setup';
    if (prompt.includes('15 minutes')) return '15 minute setup';
    if (prompt.includes('complete rules walkthrough')) return 'Full rules walkthrough';
    return 'Quick setup';
  }
  const topic = /Topic:\s*([^.]+)\./.exec(prompt);
  const named = topic?.[1]?.trim();
  if (named !== undefined && named.length > 0) return named;
  return 'Rules question';
}

/** Game name from a setup or rules prompt, such as "Dominion: Prosperity". */
export function versionNameFromPrompt(content: string): string | undefined {
  const match = /^(?:Quick setup guide|Rules question) for ([^.]+)\./.exec(content.trim());
  const name = match?.[1]?.trim();
  if (name === undefined || name.length === 0) return undefined;
  return name;
}

export function newDiscussionId(): string {
  return `disc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The chat is stored on the parent game. An expansion such as Prosperity
 * still hangs off Dominion when that base game is in the collection.
 */
export function resolveGameAnchor(
  selected: { gameId?: GameId; gameName?: string },
  games: CollectionGame[],
): GameAnchor | null {
  const owned =
    selected.gameId !== undefined
      ? games.find((game) => game.id === selected.gameId)
      : games.find(
          (game) =>
            selected.gameName !== undefined &&
            game.name.toLowerCase() === selected.gameName.trim().toLowerCase(),
        );
  const versionName = owned?.name ?? selected.gameName?.trim();
  if (versionName === undefined || versionName.length === 0) return null;

  let anchor = owned;
  if (owned?.kind === 'expansion' && owned.parentBggId !== undefined) {
    const parent = games.find(
      (game) => game.kind !== 'expansion' && game.bggId === owned.parentBggId,
    );
    if (parent !== undefined) anchor = parent;
  }

  if (anchor !== undefined) {
    return {
      key: `game:${anchor.id}`,
      gameId: anchor.id,
      gameName: anchor.name,
      versionName,
    };
  }
  return {
    key: `name:${versionName.toLowerCase()}`,
    gameName: versionName,
    versionName,
  };
}

function isHelpThread(thread: ChatThread): boolean {
  return thread.reason === 'setup' || thread.reason === 'rules' || thread.reason === 'general';
}

/**
 * The single chat for this parent game. Also adopts an older setup or rules
 * thread about the base game or one of its expansions.
 */
export function findGameThread(
  threads: ChatThread[],
  anchor: GameAnchor,
  games: readonly CollectionGame[] = [],
): ChatThread | undefined {
  const keyed = threads.find((thread) => thread.gameKey === anchor.key);
  if (keyed !== undefined) return keyed;

  const familyIds = new Set<string>();
  if (anchor.gameId !== undefined) familyIds.add(anchor.gameId);
  const parent = games.find((game) => game.id === anchor.gameId);
  if (parent?.bggId !== undefined) {
    for (const game of games) {
      if (game.bggId === parent.bggId || game.parentBggId === parent.bggId) {
        familyIds.add(game.id);
      }
    }
  }
  const names = new Set(
    [anchor.gameName, anchor.versionName]
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0),
  );

  return threads
    .filter((thread) => {
      if (!isHelpThread(thread)) return false;
      if (thread.gameId !== undefined && familyIds.has(thread.gameId)) return true;
      const name = thread.gameName?.trim().toLowerCase();
      return name !== undefined && names.has(name);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
