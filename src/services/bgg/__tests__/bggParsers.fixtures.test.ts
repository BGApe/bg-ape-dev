import { readFileSync } from 'fs';
import { join } from 'path';

import { parseThingXml } from '../bggParsers';

const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

describe('parseThingXml fixtures', () => {
  it('parses Dominion (base set, 2008)', () => {
    const [thing] = parseThingXml(loadFixture('thing-36218.xml'));
    expect(thing).toBeDefined();
    expect(thing?.bggId).toBe(36218);
    expect(thing?.name).toBe('Dominion');
    expect(thing?.kind).toBe('boardgame');
    expect(thing?.expansionCount).toBeGreaterThan(0);
    expect(thing?.yearPublished).toBe(2008);
    expect(thing?.minPlayers).toBe(2);
    expect(thing?.maxPlayers).toBe(4);
    expect(thing?.playingTime).toBe(30);
    expect(thing?.bggRank).toBe(146);
    expect(thing?.usersRated).toBe(97269);
    expect(thing?.averageWeight).toBeCloseTo(2.3442, 3);
    expect(thing?.bggRating).toBeCloseTo(7.597, 2);
    expect(thing?.categories).toEqual(['Card Game', 'Medieval']);
    expect(thing?.mechanics).toEqual([
      'Deck, Bag, and Pool Building',
      'Delayed Purchase',
      'Hand Management',
      'Open Drafting',
      'Take That',
      'Variable Set-up',
    ]);
    expect(thing?.thumbnailUrl).toMatch(/^https?:\/\//);
  });

  it('parses Star Wars: The Deckbuilding Game (base set)', () => {
    const [thing] = parseThingXml(loadFixture('thing-374173.xml'));
    expect(thing).toBeDefined();
    expect(thing?.bggId).toBe(374173);
    expect(thing?.name).toBe('Star Wars: The Deckbuilding Game');
    expect(thing?.kind).toBe('boardgame');
    expect(thing?.yearPublished).toBe(2023);
    expect(thing?.minPlayers).toBe(2);
    expect(thing?.maxPlayers).toBe(2);
    expect(thing?.playingTime).toBe(90);
    expect(thing?.bggRank).toBeGreaterThan(0);
    expect(thing?.categories).toEqual([
      'Card Game',
      'Fighting',
      'Movies / TV / Radio theme',
      'Science Fiction',
    ]);
    expect(thing?.mechanics).toEqual([
      'Deck, Bag, and Pool Building',
      'Open Drafting',
      'Tug of War',
    ]);
  });

  it('parses Watergate (2019)', () => {
    const [thing] = parseThingXml(loadFixture('thing-274364.xml'));
    expect(thing).toBeDefined();
    expect(thing?.bggId).toBe(274364);
    expect(thing?.name).toBe('Watergate');
    expect(thing?.kind).toBe('boardgame');
    expect(thing?.yearPublished).toBe(2019);
    expect(thing?.minPlayers).toBe(2);
    expect(thing?.maxPlayers).toBe(2);
    expect(thing?.playingTime).toBe(60);
    expect(thing?.bggRank).toBeGreaterThan(0);
    expect(thing?.categories).toEqual(['Card Game', 'Political']);
    expect(thing?.mechanics).toEqual([
      'Action / Event',
      'Campaign / Battle Card Driven',
      'Connections',
      'Hand Management',
      'Once-Per-Game Abilities',
      'Take That',
      'Tug of War',
    ]);
  });

  it('parses the combined batch fixture into three games', () => {
    const things = parseThingXml(loadFixture('things-dominion-sw-watergate.xml'));
    expect(things.map((t) => t.bggId).sort((a, b) => a - b)).toEqual([36218, 274364, 374173]);
    expect(things.every((t) => t.bggRank !== undefined && t.bggRank > 0)).toBe(true);
  });
});
