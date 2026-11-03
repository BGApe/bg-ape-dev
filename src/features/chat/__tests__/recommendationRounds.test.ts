import type { ChatMessage } from '@/features/chat/types';
import type { MessageId, ThreadId } from '@/types';

import { groupRecommendationRounds } from '../lib/recommendationRounds';

function message(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: id as MessageId,
    threadId: 't1' as ThreadId,
    role,
    content,
    createdAt: 1,
    ...extra,
  };
}

describe('groupRecommendationRounds', () => {
  it('puts each suggested game under the request that asked for it', () => {
    const rounds = groupRecommendationRounds([
      message('u1', 'user', 'Help me pick a game for 4 players.'),
      message(
        'a1',
        'assistant',
        'Five picks.\n\n• Azul — short teach\n• Wingspan — engine building',
        { suggestedGames: ['Azul', 'Wingspan'] },
      ),
    ]);

    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.query).toBe('Help me pick a game for 4 players.');
    expect(rounds[0]?.intro).toBe('Five picks.');
    expect(rounds[0]?.tips.map((tip) => tip.name)).toEqual(['Azul', 'Wingspan']);
    expect(rounds[0]?.tips[0]?.body).toBe('Azul — short teach');
  });

  it('nests a more-details answer on the matching tip instead of a new umbrella', () => {
    const rounds = groupRecommendationRounds([
      message('u1', 'user', 'Pick a game', { label: 'Pick a game' }),
      message('a1', 'assistant', '• Azul — tiles', { suggestedGames: ['Azul'] }),
      message('u2', 'user', 'Tell me more about Azul.', {
        label: 'More about Azul',
        segmentTitle: 'Azul',
      }),
      message('a2', 'assistant', 'Azul is a tile draft.', { segmentTitle: 'Azul' }),
    ]);

    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.tips[0]?.followups.map((item) => item.content)).toEqual([
      'Azul is a tile draft.',
    ]);
  });

  it('builds tip cards from bullets when the structured list is missing', () => {
    const rounds = groupRecommendationRounds([
      message('u1', 'user', 'Help me pick a game.'),
      message('a1', 'assistant', 'A few options.\n\n• Azul: short teach\n• Wingspan — birds'),
    ]);

    expect(rounds[0]?.intro).toBe('A few options.');
    expect(rounds[0]?.tips.map((tip) => tip.name)).toEqual(['Azul', 'Wingspan']);
    expect(rounds[0]?.tips[0]?.body).toBe('Azul: short teach');
  });

  it('shows a prose answer under the request when it names no games', () => {
    const rounds = groupRecommendationRounds([
      message('u1', 'user', 'Help me pick a game.'),
      message('a1', 'assistant', 'How many people are playing, and how long do you have?'),
    ]);

    expect(rounds[0]?.tips).toEqual([]);
    expect(rounds[0]?.intro).toBe('How many people are playing, and how long do you have?');
  });

  it('nests a follow-up such as easiest setup under the original search', () => {
    const rounds = groupRecommendationRounds([
      message('u1', 'user', 'First ask'),
      message('a1', 'assistant', '• Azul — tiles', { suggestedGames: ['Azul'] }),
      message('u2', 'user', 'Rank these by setup.', { label: 'Easiest setup' }),
      message('a2', 'assistant', '• Brass — industry', { suggestedGames: ['Brass'] }),
    ]);

    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.query).toBe('First ask');
    expect(rounds[0]?.tips.map((tip) => tip.name)).toEqual(['Azul']);
    expect(rounds[0]?.topics.map((topic) => topic.title)).toEqual(['Easiest setup']);
    expect(rounds[0]?.topics[0]?.tips[0]?.name).toBe('Brass');
  });

  it('starts a new search bar when the player asks the picker again', () => {
    const rounds = groupRecommendationRounds([
      message('u1', 'user', 'Help me pick a board game to play. We are 3 players.'),
      message('a1', 'assistant', '• Azul — tiles', { suggestedGames: ['Azul'] }),
      message('u2', 'user', 'Help me pick a board game to play. We are 5 players.'),
      message('a2', 'assistant', '• Brass — industry', { suggestedGames: ['Brass'] }),
    ]);

    expect(rounds.map((round) => round.query)).toEqual([
      'Help me pick a board game to play. We are 3 players.',
      'Help me pick a board game to play. We are 5 players.',
    ]);
    expect(rounds[0]?.topics).toEqual([]);
    expect(rounds[1]?.tips[0]?.name).toBe('Brass');
  });
});
