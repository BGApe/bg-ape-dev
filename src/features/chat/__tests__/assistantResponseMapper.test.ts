import type { AssistantResponse } from '@/features/assistant/types';
import type { ThreadId } from '@/types';

import { assistantResponseToChatMessages } from '../mappers/assistantResponseMapper';

const THREAD_ID = 'thread-test-001' as ThreadId;

describe('assistantResponseToChatMessages', () => {
  it('maps a recommendation response to a single assistant ChatMessage', () => {
    const response: AssistantResponse = {
      type: 'recommendation',
      title: 'Game Picks',
      summary: 'Great games for you.',
      bullets: ['Wingspan', 'Azul', 'Cascadia'],
    };

    const messages = assistantResponseToChatMessages(response, THREAD_ID);

    expect(messages).toHaveLength(1);
    const [msg] = messages;
    expect(msg).toBeDefined();
    if (msg === undefined) return;

    expect(msg.role).toBe('assistant');
    expect(msg.threadId).toBe(THREAD_ID);
    expect(msg.content).toContain('Game Picks');
    expect(msg.content).toContain('Great games for you.');
    expect(msg.content).toContain('• Wingspan');
    expect(msg.content).toContain('• Azul');
    expect(msg.content).toContain('• Cascadia');
    expect(msg.createdAt).toBeGreaterThan(0);
  });

  it('maps a quick_guide response to a single assistant ChatMessage', () => {
    const response: AssistantResponse = {
      type: 'quick_guide',
      title: 'How to Play',
      summary: 'Follow these steps.',
      bullets: ['Step 1: Setup', 'Step 2: Play', 'Step 3: Score'],
    };

    const messages = assistantResponseToChatMessages(response, THREAD_ID);

    expect(messages).toHaveLength(1);
    const [msg] = messages;
    expect(msg).toBeDefined();
    if (msg === undefined) return;

    expect(msg.role).toBe('assistant');
    expect(msg.content).toContain('How to Play');
    expect(msg.content).toContain('Follow these steps.');
    expect(msg.content).toContain('• Step 1: Setup');
  });

  it('maps a generic response to a single assistant ChatMessage', () => {
    const response: AssistantResponse = {
      type: 'generic',
      title: 'Info',
      summary: 'Here is some info.',
      bullets: ['Fact 1', 'Fact 2'],
    };

    const messages = assistantResponseToChatMessages(response, THREAD_ID);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('assistant');
  });

  it('assigns a unique id to the returned message', () => {
    const response: AssistantResponse = {
      type: 'recommendation',
      title: 'Title',
      summary: 'Summary.',
      bullets: [],
    };

    const [a] = assistantResponseToChatMessages(response, THREAD_ID);
    const [b] = assistantResponseToChatMessages(response, THREAD_ID);

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (a === undefined || b === undefined) return;

    expect(a.id).not.toBe(b.id);
  });
});
