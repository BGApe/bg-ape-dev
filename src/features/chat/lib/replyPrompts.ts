import { detectPlayerCount } from '@/features/assistant/lib/collectionContext';

import type { ChatMessage } from '../types';

export type HiddenPrompt = {
  /** Short text shown in the user bubble. */
  label: string;
  /** Full instruction sent to the assistant and kept in history. */
  text: string;
};

const RULES_TOPIC_CHIPS = [
  'Setup',
  'Basic rules',
  'Special rules',
  'Scoring',
  'Variants',
  'FAQ',
] as const;

const RULES_TOPIC_QUESTIONS: Record<string, string> = {
  'Table setup': 'How is the table set up?',
  'Initial resources': 'What does each player start with?',
  Cards: 'How do the cards work?',
};

export function moreGamesPrompt(excluded: string[]): HiddenPrompt {
  return moreTipsPrompt(excluded);
}

export function moreTipsPrompt(excluded: string[]): HiddenPrompt {
  const list = excluded.map((name) => name.trim()).filter((name) => name.length > 0);
  const avoid =
    list.length > 0 ? ` Do not suggest any of these games again: ${list.join(', ')}.` : '';
  return {
    label: 'More tips like this',
    text: `Suggest exactly 5 more board games that fit my original criteria.${avoid} Every title must be new. Put only those 5 titles in suggestedGames. Start each bullet with the game title. Do not repeat my request.`,
  };
}

export function tipDetailsPrompt(game: string): HiddenPrompt {
  return {
    label: `More about ${game}`,
    text: `Tell me more about ${game}: who it is for, how a turn feels, and what makes it different from games like it. A short paragraph is enough. Do not recommend other games. Return an empty suggestedGames array.`,
  };
}

export function similarGamesPrompt(game: string, excluded: string[]): HiddenPrompt {
  const blocked = [game, ...excluded].map((name) => name.trim()).filter((name) => name.length > 0);
  return {
    label: `Similar to ${game}`,
    text: `Suggest exactly 5 board games similar to ${game}: close in theme, complexity, and length. Do not suggest any of these: ${blocked.join(', ')}. Put only the 5 new titles in suggestedGames. Start each bullet with the game title. Do not repeat my request.`,
  };
}

export function easiestSetupPrompt(games: string[], metadata: string[]): HiddenPrompt {
  const names = games.map((name) => name.trim()).filter((name) => name.length > 0);
  const stored =
    metadata.length > 0 ? ` Metadata already stored for these games:\n${metadata.join('\n')}` : '';
  return {
    label: 'Easiest setup',
    text: `Of these recommended games — ${names.join(', ')} — rank them from easiest setup to hardest setup.${stored} Use weight, play time, player count, and mechanics as clues for how long the table takes to set up. List every one of these games and no others. Put them in suggestedGames in that easiest-first order. One bullet per game, starting with the title, on why its setup is easier or harder. Do not repeat my request.`,
  };
}

export function quickOverviewPrompt(game: string): HiddenPrompt {
  return {
    label: `Quick rules overview · ${game}`,
    text: `Give me a short overview of how to play ${game}: the goal, a typical turn, and how you win. Keep it to a few bullets. Do not recommend other games. Return an empty suggestedGames array.`,
  };
}

export function moreInfoPrompt(game: string): HiddenPrompt {
  return {
    label: `More about ${game}`,
    text: `Tell me more about ${game}: its story or theme, and the main mechanics that make it feel the way it does. Do not recommend other games. Return an empty suggestedGames array.`,
  };
}

export function comparePrompt(game: string, suggestionCount: number): HiddenPrompt {
  const count = Math.max(suggestionCount, 1);
  const peers = count === 1 ? 'peer' : 'peers';
  return {
    label: `Compare ${game} with ${count} ${peers}`,
    text: `Compare ${game} with exactly ${count} similar board games — the same number as the latest set of suggestions. Explain how each peer differs in style, complexity, player count, and what it is best at. Put exactly those ${count} new titles in suggestedGames, and do not reuse a game already suggested in this conversation. Do not repeat my request.`,
  };
}

export type RulesHandoff =
  | { kind: 'topic'; topic: string }
  | { kind: 'question'; question: string };

/** Maps a follow-up chip onto the rules-helper screen. */
export function rulesHelperHandoff(topic: string): RulesHandoff {
  if ((RULES_TOPIC_CHIPS as readonly string[]).includes(topic)) {
    return { kind: 'topic', topic };
  }
  return {
    kind: 'question',
    question: RULES_TOPIC_QUESTIONS[topic] ?? `Explain ${topic}.`,
  };
}

export function detailedSetupPrompt(game: string): HiddenPrompt {
  return {
    label: 'More help with setup',
    text: `Give a more detailed setup for ${game} than a quick start. Cover the table layout, how to sort the components, what each player starts with, turn order, and exactly how the first turn begins. Stay on setup. Do not move into scoring or strategy. Return an empty suggestedGames array.`,
  };
}

export function popularStrategiesPrompt(game: string): HiddenPrompt {
  return {
    label: 'Popular strategies',
    text: `Describe the top 3 ways players win at ${game}, based on widely discussed BoardGameGeek strategy. For each strategy write a short title and 3 to 4 sentences on how it collects points or otherwise wins. Keep the three distinct. Do not recommend other games. Return an empty suggestedGames array.`,
  };
}

export function strategyDetailPrompt(game: string): HiddenPrompt {
  return {
    label: 'More on these strategies',
    text: `Go deeper on the winning strategies just described for ${game}. For each one, explain how it works in play, when to leave it, and a short example of a strong opening. Do not repeat the short summaries verbatim. Return an empty suggestedGames array.`,
  };
}

export function setupDepthPrompt(
  game: string,
  depth: 'basic' | 'full',
  players?: string,
): HiddenPrompt {
  const table = players !== undefined && players.length > 0 ? ` We are ${players} players.` : '';
  if (depth === 'basic') {
    return {
      label: '15 minute setup',
      text: `Quick setup guide for ${game}.${table} Walk me through the core rules so we understand the basics (15 minutes). Return an empty suggestedGames array.`,
    };
  }
  return {
    label: 'Full rules walkthrough',
    text: `Quick setup guide for ${game}.${table} Give me a complete rules walkthrough. Return an empty suggestedGames array.`,
  };
}

/**
 * Extra instructions for the model only. The stored prompt stays the short
 * depth sentence the player saw on the form.
 */
export function setupDepthNote(depth: 'quick' | 'basic' | 'full'): string {
  if (depth === 'quick') {
    return [
      'Answer at the 5-minute level.',
      'Give the bare minimum to start the first turn: the essential mechanics, and the minimum table setup.',
      'Use the base configuration only. Include pieces that must be there every game.',
      'Leave out optional expansions and modules that can be added or removed, and name what you left out in one short line.',
      'Skip scoring edge cases, rare exceptions, and variant setups.',
    ].join(' ');
  }
  if (depth === 'basic') {
    return [
      'Answer at the 15-minute core-rules level.',
      'First, the table: where each component goes, and which figures, characters, and resources each player takes.',
      'Then the basics of play: the core rules, the main mechanics, and how scoring works.',
      'Skip rare exceptions and optional modules.',
    ].join(' ');
  }
  return [
    'Answer with a complete rules walkthrough. This is the long form.',
    'Write separate sections. Start each section with a markdown heading on its own line, exactly like ## Table setup.',
    'Under each heading write one short paragraph, then bullet points for the concrete steps, pieces, or a short example.',
    'Cover what fits this game, in this order when it applies:',
    'what must be on the table every game, and which cards, modules, or expansions are chosen to change the experience;',
    'components and resources, where each one goes, and what it is commonly used for;',
    'the turn or phase flow, including how players interact in between with attacks, reactions, or similar;',
    'each major action as its own section, with one short example (for a deck-builder, keep action cards separate from buys);',
    'scoring cards and the conditions for scoring;',
    'how different sets, modules, or expansions change the pace and the feel of the game.',
    'Use only the headings this game needs. Keep each section concise. Do not merge the sections into one paragraph.',
    'Return an empty suggestedGames array.',
  ].join(' ');
}

export function differentStrategiesPrompt(game: string, existing: readonly string[]): HiddenPrompt {
  const avoid =
    existing.length > 0 ? ` Do not repeat these strategies: ${existing.join('; ')}.` : '';
  return {
    label: 'Different strategies',
    text: `Describe 3 other ways players win at ${game}, based on widely discussed BoardGameGeek strategy.${avoid} For each strategy write a short title and 3 to 4 sentences. Keep the three distinct from each other. Return an empty suggestedGames array.`,
  };
}

export function strategyFocusPrompt(game: string, title: string): HiddenPrompt {
  return {
    label: `More detail on ${title}`,
    text: `For ${game}, explain the winning strategy "${title}" in more detail. Cover how it collects points or wins, how to play it from the opening through the end, and when it stops working. Use a short example. Do not stop at a one-line summary. Return an empty suggestedGames array.`,
  };
}

export function coreMechanicsPrompt(game: string, players?: string): HiddenPrompt {
  const table = players !== undefined && players.length > 0 ? ` We are ${players} players.` : '';
  return {
    label: 'Core mechanics',
    text: `Rules question for ${game}.${table} Topic: Core mechanics. Explain the basics of a turn and how players interact, including how a round begins and ends. Keep it to the core loop. Return an empty suggestedGames array.`,
  };
}

export function payAttentionPrompt(game: string, players?: string): HiddenPrompt {
  const table = players !== undefined && players.length > 0 ? ` We are ${players} players.` : '';
  return {
    label: 'Pay attention to',
    text: `Rules question for ${game}.${table} Topic: Pay attention to. Cover unusual rules that BoardGameGeek players keep discussing, and things that are commonly forgotten, such as tokens, counters, and numbers that have to be added at a specific time. Write a short paragraph for each point. When a point belongs to an expansion, name that expansion. Return an empty suggestedGames array.`,
  };
}

export function topicFollowupPrompt(game: string, topic: string): HiddenPrompt {
  const question = RULES_TOPIC_QUESTIONS[topic] ?? `Explain ${topic}.`;
  return {
    label: topic,
    text: `Rules question for ${game}. Topic: ${topic}. ${question} Do not repeat my request. Return an empty suggestedGames array.`,
  };
}

export function elaboratePrompt(game: string, topic: string): HiddenPrompt {
  return {
    label: `Elaborate · ${topic}`,
    text: `Elaborate further on ${topic} for ${game}. Go deeper than your previous answer: add the edge cases, a short example, and anything a player usually gets wrong. Do not repeat your previous answer verbatim. Return an empty suggestedGames array.`,
  };
}

/** Rewrites the opening request so it applies to a different game. */
export function retargetGamePrompt(
  original: string,
  previousName: string | undefined,
  nextName: string,
  reason: 'setup' | 'rules',
): HiddenPrompt {
  const label = reason === 'rules' ? `Rules help · ${nextName}` : `Quick setup · ${nextName}`;
  let text = original.trim();
  if (
    previousName !== undefined &&
    previousName.length > 0 &&
    previousName !== nextName &&
    text.includes(previousName)
  ) {
    text = text.split(previousName).join(nextName);
  } else if (text.length === 0) {
    text =
      reason === 'rules'
        ? `Rules question for ${nextName}. Explain setup and the core turn.`
        : `Quick setup guide for ${nextName}.`;
  } else {
    const lead =
      reason === 'rules' ? `Rules question for ${nextName}.` : `Quick setup guide for ${nextName}.`;
    text = `${lead} ${text}`;
  }
  return {
    label,
    text: `${text} Answer for ${nextName}. Do not repeat my request.`,
  };
}

/** Tells the model to answer from the base game and the owned expansions. */
export function rulesFamilyNote(
  focus: { name: string; kind: string; bggId?: number; parentBggId?: number } | undefined,
  games: readonly { name: string; kind: string; bggId?: number; parentBggId?: number }[],
): string {
  const parentBggId = focus?.kind === 'expansion' ? focus.parentBggId : focus?.bggId;
  const base =
    parentBggId !== undefined
      ? games.find((game) => game.kind !== 'expansion' && game.bggId === parentBggId)
      : focus?.kind !== 'expansion'
        ? focus
        : undefined;
  const expansions =
    parentBggId !== undefined
      ? games.filter((game) => game.kind === 'expansion' && game.parentBggId === parentBggId)
      : [];
  const baseName = base?.name ?? focus?.name ?? 'the base game';
  const expansionList =
    expansions.length > 0 ? expansions.map((game) => game.name).join(', ') : 'its expansions';
  return `Use the rules of ${baseName} together with ${expansionList}. When a card, score, or rule exists only in an expansion, name that expansion and say it is not in the base game.`;
}

export function playerCountFromMessages(messages: ChatMessage[]): string | undefined {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const count = detectPlayerCount(message.content);
    if (count !== undefined) return count;
  }
  return undefined;
}
