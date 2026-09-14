import type { CollectionGame } from '@/features/collection/types';
import type { Play } from '@/features/plays/types';
import type { GameId, PlayId, UserId } from '@/types';

import {
  buildCollectionContext,
  detectActivityBias,
  estimateCollectionContextTokens,
  formatCollectionContextBlock,
} from '../lib/collectionContext';

function game(partial: Partial<CollectionGame> & { id: GameId; name: string }): CollectionGame {
  return {
    source: 'bgg',
    addedAt: 1,
    kind: 'base',
    ...partial,
  };
}

function play(gameId: GameId, playedAt: number): Play {
  return {
    id: `p-${gameId}-${playedAt}` as PlayId,
    userId: 'u1' as UserId,
    gameName: 'x',
    gameId,
    playedAt,
    createdAt: playedAt,
  };
}

describe('buildCollectionContext', () => {
  const now = Date.UTC(2026, 8, 12);
  const g1 = 'g1' as GameId;
  const g2 = 'g2' as GameId;
  const exp1 = 'exp1' as GameId;

  const games: CollectionGame[] = [
    game({
      id: g1,
      name: 'Dominion',
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 30,
      averageWeight: 2.34,
      mechanics: ['Deck, Bag, and Pool Building', 'Hand Management', 'Take That'],
      categories: ['Card Game', 'Medieval'],
    }),
    game({
      id: g2,
      name: 'Watergate',
      minPlayers: 2,
      maxPlayers: 2,
      playingTime: 60,
      averageWeight: 2.3,
      mechanics: ['Tug of War'],
      categories: ['Political'],
    }),
    game({
      id: exp1,
      name: 'Dominion: Intrigue',
      kind: 'expansion',
      parentBggId: 36218,
    }),
  ];

  const plays: Play[] = [
    play(g1, now - 3 * 86_400_000),
    play(g1, now - 10 * 86_400_000),
    play(g2, now - 1 * 86_400_000),
  ];

  it('omits expansions and includes play stats at optimal level', () => {
    const items = buildCollectionContext(games, plays, 'optimal', now);
    expect(items.map((i) => i.name)).toEqual(['Dominion', 'Watergate']);
    expect(items[0]?.playCount).toBe(2);
    expect(items[0]?.daysSinceLastPlay).toBe(3);
    expect(items[0]?.mechanics).toEqual(['Deck, Bag, and Pool Building', 'Hand Management']);
    expect(items[0]?.mechanics).toHaveLength(2);
  });

  it('minimal level is name-only', () => {
    const items = buildCollectionContext(games, plays, 'minimal', now);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ name: 'Dominion' });
    expect(items[1]).toEqual({ name: 'Watergate' });
  });

  it('maximal keeps more tags', () => {
    const items = buildCollectionContext(games, plays, 'maximal', now);
    expect(items[0]?.mechanics?.length).toBeGreaterThan(2);
  });
});

describe('formatCollectionContextBlock / detectActivityBias', () => {
  it('formats a compact block with bias line', () => {
    const block = formatCollectionContextBlock(
      [{ name: 'Dominion', playCount: 2, daysSinceLastPlay: 3, minPlayers: 2, maxPlayers: 4 }],
      'undereplayed',
    );
    expect(block).toContain('User collection (1 base games)');
    expect(block).toContain('Dominion');
    expect(block).toContain('Activity preference');
    expect(estimateCollectionContextTokens([{ name: 'Dominion' }])).toBeGreaterThan(0);
  });

  it('detects activity bias phrases from the intent prompt', () => {
    expect(detectActivityBias('Prefer games we have played less often (fresh picks).')).toBe(
      'undereplayed',
    );
    expect(detectActivityBias('Prefer our frequently played favorites.')).toBe('favorites');
    expect(detectActivityBias('Prefer games we played recently.')).toBe('recent');
    expect(detectActivityBias('Help me pick a board game to play.')).toBe('none');
  });
});
