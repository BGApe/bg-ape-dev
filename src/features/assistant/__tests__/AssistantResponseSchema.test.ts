import { AssistantResponseSchema } from '../schemas';

describe('AssistantResponseSchema', () => {
  it('parses a valid AssistantResponse successfully', () => {
    const input = {
      type: 'recommendation',
      title: 'Top Picks',
      summary: 'Here are some great games.',
      bullets: ['Wingspan', 'Azul'],
    };

    const result = AssistantResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('recommendation');
      expect(result.data.bullets).toHaveLength(2);
    }
  });

  it('parses a valid AssistantResponse with optional metadata', () => {
    const input = {
      type: 'quick_guide',
      title: 'Quick Start',
      summary: 'Setup in 5 steps.',
      bullets: ['Step 1', 'Step 2'],
      metadata: { source: 'bgg', gameId: 12345 },
    };

    const result = AssistantResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toBeDefined();
    }
  });

  it('fails when title is missing', () => {
    const input = {
      type: 'recommendation',
      summary: 'Some summary.',
      bullets: [],
    };

    const result = AssistantResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('title');
    }
  });

  it('fails when type is not a valid enum value', () => {
    const input = {
      type: 'unknown_type',
      title: 'Title',
      summary: 'Summary.',
      bullets: [],
    };

    const result = AssistantResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when bullets is missing', () => {
    const input = {
      type: 'generic',
      title: 'Title',
      summary: 'Summary.',
    };

    const result = AssistantResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
