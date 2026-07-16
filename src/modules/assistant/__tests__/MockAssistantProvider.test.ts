import type { AssistantRequest } from '@/features/assistant/types';

import { MockAssistantProvider } from '../MockAssistantProvider';

const provider = new MockAssistantProvider();

const recommendationRequest: AssistantRequest = {
  text: 'Recommend me a game',
  intent: 'recommendation',
};

const quickGuideRequest: AssistantRequest = {
  text: 'How do I play Wingspan?',
  intent: 'quick_guide',
};

describe('MockAssistantProvider.complete()', () => {
  it('returns a deterministic AssistantResponse for recommendation intent', async () => {
    const response = await provider.complete(recommendationRequest);

    expect(response.type).toBe('recommendation');
    expect(typeof response.title).toBe('string');
    expect(response.title.length).toBeGreaterThan(0);
    expect(typeof response.summary).toBe('string');
    expect(Array.isArray(response.bullets)).toBe(true);
  });

  it('returns a deterministic AssistantResponse for quick_guide intent', async () => {
    const response = await provider.complete(quickGuideRequest);

    expect(response.type).toBe('quick_guide');
    expect(response.bullets.length).toBeGreaterThan(0);
  });

  it('returns the same response on repeated calls for the same intent', async () => {
    const first = await provider.complete(recommendationRequest);
    const second = await provider.complete(recommendationRequest);

    expect(first.type).toBe(second.type);
    expect(first.title).toBe(second.title);
    expect(first.summary).toBe(second.summary);
  });
});

describe('MockAssistantProvider.stream()', () => {
  it('yields AssistantChunks and terminates with done: true', async () => {
    const chunks: { delta: string; done: boolean }[] = [];

    for await (const chunk of provider.stream(recommendationRequest)) {
      chunks.push(chunk);
      if (chunk.done) break;
    }

    expect(chunks.length).toBeGreaterThan(0);
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk).toBeDefined();
    if (lastChunk === undefined) return;
    expect(lastChunk.done).toBe(true);
  });

  it('all non-final chunks have done: false', async () => {
    const chunks: { delta: string; done: boolean }[] = [];

    for await (const chunk of provider.stream(quickGuideRequest)) {
      chunks.push(chunk);
      if (chunk.done) break;
    }

    const nonFinal = chunks.slice(0, -1);
    for (const chunk of nonFinal) {
      expect(chunk.done).toBe(false);
    }
  });

  it('concatenated deltas form a non-empty string', async () => {
    let full = '';

    for await (const chunk of provider.stream(recommendationRequest)) {
      full += chunk.delta;
      if (chunk.done) break;
    }

    expect(full.length).toBeGreaterThan(0);
  });
});
