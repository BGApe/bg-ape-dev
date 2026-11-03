import { setupDepthNote } from '../lib/replyPrompts';
import { splitSetupSections } from '../lib/setupSections';

describe('splitSetupSections', () => {
  it('splits a walkthrough into titled sections and keeps the lead-in', () => {
    const split = splitSetupSections(
      [
        'Dominion, base cards only.',
        '## Supply',
        'Ten kingdom cards.',
        '- Copper, Silver, and Gold are always there',
        '## Turn',
        'Play, buy, then draw.',
      ].join('\n'),
    );

    expect(split?.intro).toBe('Dominion, base cards only.');
    expect(split?.sections.map((section) => section.title)).toEqual(['Supply', 'Turn']);
    expect(split?.sections[0]?.body).toContain('Copper, Silver, and Gold');
  });

  it('leaves a short answer as prose', () => {
    expect(splitSetupSections('Lay out the supply.')).toBeNull();
  });
});

describe('setupDepthNote', () => {
  it('asks the 5-minute pass for the base layout only', () => {
    const note = setupDepthNote('quick');
    expect(note).toContain('bare minimum');
    expect(note).toContain('Leave out optional expansions');
  });

  it('asks the 15-minute pass for setup and scoring', () => {
    const note = setupDepthNote('basic');
    expect(note).toContain('figures, characters, and resources');
    expect(note).toContain('how scoring works');
  });

  it('asks the full walkthrough for separate headed sections', () => {
    const note = setupDepthNote('full');
    expect(note).toContain('## Table setup');
    expect(note).toContain('action cards');
    expect(note).toContain('scoring');
  });
});
