import type { ChatMessage } from '@/features/chat/types';
import type { MessageId, ThreadId } from '@/types';

import {
  buildConversationHistory,
  formatConversationHistoryBlock,
} from '../lib/conversationHistory';

function msg(
  role: ChatMessage['role'],
  content: string,
  opts: { optimistic?: boolean } = {},
): ChatMessage {
  const base: ChatMessage = {
    id: `m-${role}-${content.slice(0, 8)}` as MessageId,
    threadId: 't1' as ThreadId,
    role,
    content,
    createdAt: Date.now(),
  };
  if (opts.optimistic) base.isOptimistic = true;
  return base;
}

describe('buildConversationHistory', () => {
  const thread: ChatMessage[] = [
    msg('user', 'First question'),
    msg('assistant', 'First answer'),
    msg('user', 'Second question'),
    msg('assistant', 'Second answer'),
    msg('user', 'Third question'),
    msg('assistant', 'Third answer'),
    msg('user', 'Fourth question'),
    msg('assistant', 'Fourth answer'),
  ];

  it('optimal keeps the last 6 messages', () => {
    const history = buildConversationHistory(thread, 'optimal');
    expect(history).toHaveLength(6);
    expect(history[0]?.content).toBe('Second question');
    expect(history[5]?.content).toBe('Fourth answer');
  });

  it('minimal keeps the last 2 messages', () => {
    const history = buildConversationHistory(thread, 'minimal');
    expect(history).toHaveLength(2);
    expect(history.map((m) => m.content)).toEqual(['Fourth question', 'Fourth answer']);
  });

  it('skips optimistic and system messages', () => {
    const mixed: ChatMessage[] = [
      msg('user', 'Hello'),
      msg('assistant', 'Hi', { optimistic: true }),
      msg('system', 'ignore me'),
      msg('assistant', 'Real hi'),
    ];
    const history = buildConversationHistory(mixed, 'optimal');
    expect(history).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Real hi' },
    ]);
  });

  it('truncates long messages at optimal level', () => {
    const long = 'x'.repeat(600);
    const history = buildConversationHistory([msg('user', long)], 'optimal');
    expect(history[0]?.content.length).toBe(500);
    expect(history[0]?.content.endsWith('…')).toBe(true);
  });

  it('formats a readable history block', () => {
    const block = formatConversationHistoryBlock([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);
    expect(block).toContain('Recent conversation:');
    expect(block).toContain('User: Hi');
    expect(block).toContain('Assistant: Hello');
  });
});
