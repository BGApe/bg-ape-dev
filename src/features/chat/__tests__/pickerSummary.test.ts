import { Copy } from '@/constants/copy';

import { pickerScopeSentences, tastePromptSentences } from '../lib/gamePickerTaste';
import { parsePickerPrompt } from '../lib/pickerSummary';

const P = Copy.intent.gamePicker.promptParts;

describe('parsePickerPrompt', () => {
  it('turns the picker filters into icons and keeps a free-text note', () => {
    const prompt = [
      P.intro,
      P.players('3'),
      P.complexity('Low'),
      P.playTime('60'),
      ...tastePromptSentences({
        conflict: 'cooperative',
        design: 'euro',
        storyDriven: true,
        areaControl: true,
        economic: false,
        coolMinis: true,
        kidsFriendly: true,
        kidsAge: '6-9',
        cardGame: true,
        activityGame: true,
        extraTags: ['Worker Placement'],
      }),
      ...pickerScopeSentences(true),
      P.tableSize('M'),
      P.activityBias.favorites,
      'no reading',
    ].join(' ');

    const summary = parsePickerPrompt(prompt);
    expect(summary?.chips.map((chip) => `${chip.icon} ${chip.value}`)).toEqual([
      '👤 3',
      '⏱ 60m',
      '⚖ Low',
      '🪑 M',
      '📚 Owned',
      '🤝 Co-op',
      '🧩 Euro',
      '📖 Story',
      '🗺 Area',
      '🗿 Minis',
      '🃏 Cards',
      '🏃 Activity',
      '👶 6–9',
      '🏷 Worker Placement',
      '★ Favorites',
    ]);
    expect(summary?.note).toBe('no reading');
  });

  it('leaves a follow-up label as plain text', () => {
    expect(parsePickerPrompt('More tips like this')).toBeNull();
  });
});
