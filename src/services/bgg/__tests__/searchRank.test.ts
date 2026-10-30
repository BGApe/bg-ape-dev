import { rankSearchResults } from '../searchRank';

describe('rankSearchResults', () => {
  const hits = [
    { bggId: 1, name: 'Dominion: Promo Card' },
    { bggId: 2, name: 'Dominion: Prosperity' },
    { bggId: 3, name: 'Dominion' },
  ];

  it('keeps promo packs behind the main game and its expansions', () => {
    const ranked = rankSearchResults(hits, {
      3: { usersRated: 97000, bggRank: 146, bggRating: 7.6 },
      2: { usersRated: 22000, bggRating: 7.7 },
      1: { usersRated: 80 },
    });

    expect(ranked.map((hit) => hit.name)).toEqual([
      'Dominion',
      'Dominion: Prosperity',
      'Dominion: Promo Card',
    ]);
  });

  it('sinks a promo even when no stored popularity exists', () => {
    const ranked = rankSearchResults(hits, {});
    expect(ranked.map((hit) => hit.bggId)).toEqual([2, 3, 1]);
  });

  it('prefers a better rank when rating counts match', () => {
    const ranked = rankSearchResults(
      [
        { bggId: 10, name: 'Obscure edition' },
        { bggId: 11, name: 'Common edition' },
      ],
      {
        10: { bggRank: 4000, bggRating: 6 },
        11: { bggRank: 80, bggRating: 7.4 },
      },
    );
    expect(ranked[0]?.name).toBe('Common edition');
  });
});
