import type { MessageId, ThreadId, UserId } from '@/types';

import { resolveSessionPlayerCount } from '../lib/sessionPlayerCount';
import type { ChatMessage, ChatThread } from '../types';

function thread(
  partial: { id: ThreadId; createdAt: number } & Partial<Omit<ChatThread, 'id'>>,
): ChatThread {
  return {
    userId: 'u1' as UserId,
    title: 'Help me pick a game',
    reason: 'recommendation',
    updatedAt: partial.createdAt,
    ...partial,
  };
}

function msg(
  partial: Partial<ChatMessage> & { content: string; createdAt: number; role: ChatMessage['role'] },
): ChatMessage {
  return {
    id: `m-${partial.createdAt}` as MessageId,
    threadId: 't1' as ThreadId,
    ...partial,
  };
}

describe('resolveSessionPlayerCount', () => {
  const now = Date.UTC(2026, 8, 14, 16, 0, 0);

  it('reuses player count when the game was recommended within 2 hours', async () => {
    const t1 = thread({ id: 't1' as ThreadId, createdAt: now - 30 * 60_000 });
    const messages: ChatMessage[] = [
      msg({
        role: 'user',
        content: 'Help me pick a board game to play. We are 4 players.',
        createdAt: now - 30 * 60_000,
      }),
      msg({
        role: 'assistant',
        content: 'Try Dominion — great for 4.',
        createdAt: now - 29 * 60_000,
      }),
    ];

    const count = await resolveSessionPlayerCount({
      threads: [t1],
      gameName: 'Dominion',
      now,
      loadMessages: async () => messages,
    });

    expect(count).toBe('4');
  });

  it('ignores sessions older than 2 hours', async () => {
    const t1 = thread({ id: 't1' as ThreadId, createdAt: now - 3 * 60 * 60_000 });
    const count = await resolveSessionPlayerCount({
      threads: [t1],
      gameName: 'Dominion',
      now,
      loadMessages: async () => [
        msg({
          role: 'user',
          content: 'We are 4 players.',
          createdAt: now - 3 * 60 * 60_000,
        }),
        msg({
          role: 'assistant',
          content: 'Dominion',
          createdAt: now - 3 * 60 * 60_000 + 1000,
        }),
      ],
    });
    expect(count).toBeUndefined();
  });

  it('requires the game to be mentioned in the recommendation thread', async () => {
    const t1 = thread({ id: 't1' as ThreadId, createdAt: now - 10 * 60_000 });
    const count = await resolveSessionPlayerCount({
      threads: [t1],
      gameName: 'Watergate',
      now,
      loadMessages: async () => [
        msg({
          role: 'user',
          content: 'We are 2 players.',
          createdAt: now - 10 * 60_000,
        }),
        msg({
          role: 'assistant',
          content: 'Try Dominion.',
          createdAt: now - 9 * 60_000,
        }),
      ],
    });
    expect(count).toBeUndefined();
  });
});
