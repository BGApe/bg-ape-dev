import type { CollectionGame } from '@/features/collection/types';
import type { GameId } from '@/types';

import { BGG_MECHANIC_OPTIONS, resolveGamePickerTags } from '../lib/bggTagOptions';

describe('resolveGamePickerTags', () => {
  it('includes curated BGG mechanics and merges collection-only tags', () => {
    const games: CollectionGame[] = [
      {
        id: 'g1' as GameId,
        name: 'Dominion',
        source: 'bgg',
        addedAt: 1,
        kind: 'base',
        mechanics: ['Deck, Bag, and Pool Building', 'Take That'],
        categories: ['Card Game'],
      },
    ];

    const tags = resolveGamePickerTags(games);
    expect(tags).toContain(BGG_MECHANIC_OPTIONS[3]); // Deck, Bag, and Pool Building
    expect(tags).toContain('Card Game');
    expect(tags).toContain('Take That');
    // curated first, extras after
    expect(tags.indexOf('Take That')).toBeGreaterThan(tags.indexOf('Card Game'));
  });
});
