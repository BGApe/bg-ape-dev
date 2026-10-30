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
  const list = excluded.map((name) => name.trim()).filter((name) => name.length > 0);
  const avoid =
    list.length > 0 ? ` Do not suggest any of these games again: ${list.join(', ')}.` : '';
  return {
    label: 'I want more games',
    text: `Suggest more board games that fit my original criteria.${avoid} Every title must be new. Put only those new titles in suggestedGames. Do not repeat my request.`,
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

export function playerCountFromMessages(messages: ChatMessage[]): string | undefined {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const count = detectPlayerCount(message.content);
    if (count !== undefined) return count;
  }
  return undefined;
}
