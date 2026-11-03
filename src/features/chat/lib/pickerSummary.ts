import { Copy } from '@/constants/copy';

import { pickerScopeSentences, tastePromptSentences, type KidsAge } from './gamePickerTaste';

export type PickerChip = {
  id: string;
  icon: string;
  value: string;
  /** Spoken form for the bar's accessibility label. */
  spoken: string;
  color?: string;
};

export type PickerSummary = {
  chips: PickerChip[];
  note?: string;
};

const INTRO = Copy.intent.gamePicker.promptParts.intro;

/**
 * Reads a game-picker prompt back into the filters the player chose.
 * Follow-up prompts stay as written text, so this returns null for those.
 */
export function parsePickerPrompt(text: string): PickerSummary | null {
  if (!text.includes(INTRO)) return null;

  const chips: PickerChip[] = [];
  const players = /We are ([^.]+) players\./.exec(text);
  if (players?.[1] !== undefined) {
    const count = players[1].trim();
    chips.push({ id: 'players', icon: '👤', value: count, spoken: `${count} players` });
  }

  const time = /Available time: ([^.]+) minutes\./.exec(text);
  if (time?.[1] !== undefined) {
    const minutes = time[1].trim();
    chips.push({ id: 'time', icon: '⏱', value: `${minutes}m`, spoken: `${minutes} minutes` });
  }

  const complexity = /Preferred complexity: ([^.]+)\./.exec(text);
  if (complexity?.[1] !== undefined) {
    const level = complexity[1].trim();
    const chip: PickerChip = {
      id: 'complexity',
      icon: '⚖',
      value: level,
      spoken: `${level} complexity`,
    };
    const color = complexityColor(level);
    if (color !== undefined) chip.color = color;
    chips.push(chip);
  }

  const table = /Table space available: ([^.]+)\./.exec(text);
  if (table?.[1] !== undefined) {
    const size = table[1].trim();
    chips.push({ id: 'table', icon: '🪑', value: size, spoken: `${size} table` });
  }

  if (text.includes('Please suggest only from my collection.')) {
    chips.push({ id: 'collection', icon: '📚', value: 'Owned', spoken: 'From my collection' });
  }

  if (text.includes('competitive game')) {
    chips.push({ id: 'conflict', icon: '⚔', value: 'Versus', spoken: 'Competitive' });
  } else if (text.includes('cooperative game')) {
    chips.push({ id: 'conflict', icon: '🤝', value: 'Co-op', spoken: 'Cooperative' });
  }

  if (text.includes('ameritrash-style')) {
    chips.push({ id: 'design', icon: '🎲', value: 'Ameritrash', spoken: 'Ameritrash' });
  } else if (text.includes('Euro-style')) {
    chips.push({ id: 'design', icon: '🧩', value: 'Euro', spoken: 'Euro' });
  }

  if (text.includes('do not want a story-driven')) {
    chips.push({ id: 'story', icon: '📖', value: 'No', spoken: 'Not story-driven' });
  } else if (text.includes('story-driven game')) {
    chips.push({ id: 'story', icon: '📖', value: 'Story', spoken: 'Story-driven' });
  }

  if (text.includes('Include area control')) {
    chips.push({ id: 'area', icon: '🗺', value: 'Area', spoken: 'Area control' });
  }
  if (text.includes('Include an economic game')) {
    chips.push({ id: 'economic', icon: '💰', value: 'Econ', spoken: 'Economic' });
  }
  if (text.includes('cool miniatures')) {
    chips.push({ id: 'minis', icon: '🗿', value: 'Minis', spoken: 'Cool minis' });
  }
  if (text.includes('category: Card Game')) {
    chips.push({ id: 'cards', icon: '🃏', value: 'Cards', spoken: 'Card game' });
  }
  if (text.includes('activity game:')) {
    chips.push({ id: 'activity', icon: '🏃', value: 'Activity', spoken: 'Activity game' });
  }

  const age = kidsAgeLabel(text);
  if (age !== undefined) {
    chips.push({ id: 'kids', icon: '👶', value: age, spoken: `Kids ${age}` });
  } else if (text.includes('kids-friendly')) {
    chips.push({ id: 'kids', icon: '👶', value: 'Kids', spoken: 'Kids friendly' });
  }

  const tags = /Preferred BoardGameGeek categories\/mechanics: ([^.]+)\./.exec(text);
  if (tags?.[1] !== undefined) {
    for (const tag of tags[1].split(',')) {
      const name = tag.trim();
      if (name.length === 0) continue;
      chips.push({ id: `tag-${name}`, icon: '🏷', value: name, spoken: name });
    }
  }

  if (text.includes('fresh picks')) {
    chips.push({ id: 'bias', icon: '🌱', value: 'Fresh', spoken: 'Fresh picks' });
  } else if (text.includes('frequently played favorites')) {
    chips.push({ id: 'bias', icon: '★', value: 'Favorites', spoken: 'Favorites' });
  } else if (text.includes('played recently')) {
    chips.push({ id: 'bias', icon: '🕐', value: 'Recent', spoken: 'Played recently' });
  }

  const note = leftoverNote(text);
  const summary: PickerSummary = { chips };
  if (note !== undefined) summary.note = note;
  return summary;
}

function complexityColor(level: string): string | undefined {
  if (level === 'Low') return '#34D399';
  if (level === 'Medium') return '#FBBF24';
  if (level === 'High') return '#F97316';
  return undefined;
}

function kidsAgeLabel(text: string): string | undefined {
  if (text.includes('children under 6')) return 'Under 6';
  if (text.includes('aged 6 to 9')) return '6–9';
  if (text.includes('aged 10 to 12')) return '10–12';
  if (text.includes('aged 14 and up')) return '14+';
  return undefined;
}

function leftoverNote(text: string): string | undefined {
  let rest = text;
  const fixed = fixedSentences().sort((a, b) => b.length - a.length);
  for (const sentence of fixed) {
    rest = rest.split(sentence).join(' ');
  }
  rest = rest
    .replace(/We are [^.]+ players\./g, ' ')
    .replace(/Preferred complexity: [^.]+\./g, ' ')
    .replace(/Available time: [^.]+ minutes\./g, ' ')
    .replace(/Table space available: [^.]+\./g, ' ')
    .replace(/Preferred BoardGameGeek categories\/mechanics: [^.]+\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return rest.length > 0 ? rest : undefined;
}

function fixedSentences(): string[] {
  const quiet = {
    areaControl: false,
    economic: false,
    coolMinis: false,
    kidsFriendly: false,
    cardGame: false,
    activityGame: false,
    extraTags: [] as string[],
  };
  const ages: KidsAge[] = ['under-6', '6-9', '10-12', '14+'];
  return [
    INTRO,
    ...pickerScopeSentences(true),
    ...pickerScopeSentences(false),
    ...Object.values(Copy.intent.gamePicker.promptParts.activityBias),
    ...tastePromptSentences({
      ...quiet,
      conflict: 'cooperative',
      design: 'euro',
      storyDriven: true,
    }),
    ...tastePromptSentences({
      ...quiet,
      conflict: 'competitive',
      design: 'ameritrash',
      storyDriven: false,
    }),
    ...ages.flatMap((kidsAge) =>
      tastePromptSentences({
        areaControl: true,
        economic: true,
        coolMinis: true,
        kidsFriendly: true,
        cardGame: true,
        activityGame: true,
        kidsAge,
        extraTags: [],
      }),
    ),
  ];
}
