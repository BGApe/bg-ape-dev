import type { AssistantResponse } from '@/features/assistant/types';
import type { ChatMessage } from '@/features/chat/types';
import type { MessageId, ThreadId } from '@/types';

import { searchGamePickerTags } from '../lib/bggTagOptions';
import { pickerScopeSentences, tastePromptSentences } from '../lib/gamePickerTaste';
import { comparePrompt, moreGamesPrompt, rulesHelperHandoff } from '../lib/replyPrompts';
import {
  extractSuggestedGames,
  omitRepeatedSuggestions,
  previouslySuggestedGames,
} from '../lib/suggestedGames';

describe('tastePromptSentences', () => {
  it('treats conflict and design as exclusive clusters and stacks the other axes', () => {
    const sentences = tastePromptSentences({
      conflict: 'cooperative',
      design: 'euro',
      storyDriven: true,
      areaControl: true,
      economic: true,
      coolMinis: false,
      kidsFriendly: true,
      kidsAge: '6-9',
      cardGame: true,
      activityGame: true,
      extraTags: ['Worker Placement'],
    });
    const text = sentences.join(' ');

    expect(text).toContain('cooperative game');
    expect(text).toContain('Euro-style');
    expect(text).toContain('point-salad');
    expect(text).toContain('luck mitigation');
    expect(text).not.toContain('ameritrash-style');
    expect(text).toContain('story-driven');
    expect(text).toContain('Area Majority / Influence');
    expect(text).toContain('category: Economic');
    expect(text).toContain('Worker Placement');
    expect(text).toContain('kids-friendly');
    expect(text).toContain('aged 6 to 9');
    expect(text).toContain('category: Card Game');
    expect(text).toContain('activity game:');
    expect(text).toContain('charades');
  });

  it('asks for five tips, mostly outside the collection unless that filter is on', () => {
    const open = pickerScopeSentences(false).join(' ');
    expect(open).toContain('exactly 5');
    expect(open).toContain('one or two games from my collection');
    expect(open).toContain('do not own');

    const owned = pickerScopeSentences(true).join(' ');
    expect(owned).toContain('only from my collection');
    expect(owned).not.toContain('do not own');
  });

  it('describes ameritrash as minis, fighting, and dice', () => {
    const text = tastePromptSentences({
      design: 'ameritrash',
      storyDriven: false,
      areaControl: false,
      economic: false,
      coolMinis: true,
      kidsFriendly: false,
      cardGame: false,
      activityGame: false,
      extraTags: [],
    }).join(' ');

    expect(text).toContain('ameritrash-style');
    expect(text).toContain('dice rolling');
    expect(text).toContain('Miniatures');
    expect(text).toContain('do not want a story-driven');
  });
});

describe('searchGamePickerTags', () => {
  it('returns nothing until two characters, then matches', () => {
    const tags = ['Worker Placement', 'Area Majority / Influence', 'Economic'];
    expect(searchGamePickerTags(tags, 'w')).toEqual([]);
    expect(searchGamePickerTags(tags, 'work')).toEqual(['Worker Placement']);
  });
});

describe('extractSuggestedGames', () => {
  const base: AssistantResponse = {
    type: 'recommendation',
    title: 'Picks',
    summary: 'A few games.',
    bullets: ['Wingspan — engine builder', 'Azul — tiles'],
  };

  it('prefers the structured list and caps it at five', () => {
    expect(
      extractSuggestedGames({
        ...base,
        suggestedGames: ['Brass', 'Brass', 'Concordia', 'Hansa', 'Tigris', 'Azul', 'Extra'],
      }),
    ).toEqual(['Brass', 'Concordia', 'Hansa', 'Tigris', 'Azul']);
  });

  it('keeps a fifth title from the bullets when the structured list was shorter', () => {
    expect(
      extractSuggestedGames({
        ...base,
        bullets: [
          'Brass — economic',
          'Concordia — trade',
          'Hansa — routes',
          'Tigris — tiles',
          'Azul — pattern',
        ],
        suggestedGames: ['Brass', 'Concordia', 'Hansa', 'Tigris'],
      }),
    ).toEqual(['Brass', 'Concordia', 'Hansa', 'Tigris', 'Azul']);
  });

  it('falls back to names before a dash on recommendations', () => {
    expect(extractSuggestedGames(base)).toEqual(['Wingspan', 'Azul']);
  });
});

describe('more games and compare', () => {
  const prior = [
    message('a1', 'assistant', 'Picks', ['Wingspan', 'Azul']),
    message('a2', 'assistant', 'More', ['Brass', 'Concordia']),
  ];

  it('excludes every game already suggested, not only the latest four', () => {
    const names = previouslySuggestedGames(prior);
    expect(names).toEqual(['Wingspan', 'Azul', 'Brass', 'Concordia']);
    expect(moreGamesPrompt(names).text).toContain('Wingspan');
    expect(moreGamesPrompt(names).text).toContain('Concordia');
  });

  it('asks compare for the same number of peers as the latest suggestion set', () => {
    const prompt = comparePrompt('Wingspan', 4);
    expect(prompt.label).toBe('Compare Wingspan with 4 peers');
    expect(prompt.text).toContain('exactly 4');
  });

  it('drops repeated titles from the new reply', () => {
    const next = omitRepeatedSuggestions(
      [message('a3', 'assistant', 'Again', ['Azul', 'Spirit Island'])],
      ['Azul'],
    );
    expect(next[0]?.suggestedGames).toEqual(['Spirit Island']);
  });
});

function message(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  suggestedGames?: string[],
): ChatMessage {
  return {
    id: id as MessageId,
    threadId: 't1' as ThreadId,
    role,
    content,
    createdAt: 1,
    ...(suggestedGames !== undefined ? { suggestedGames } : {}),
  };
}

describe('rulesHelperHandoff', () => {
  it('keeps chip topics as topics and turns table setup into a question', () => {
    expect(rulesHelperHandoff('Scoring')).toEqual({ kind: 'topic', topic: 'Scoring' });
    expect(rulesHelperHandoff('Table setup')).toEqual({
      kind: 'question',
      question: 'How is the table set up?',
    });
  });
});
