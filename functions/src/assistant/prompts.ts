type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';
type ActivityBias = 'none' | 'undereplayed' | 'favorites' | 'recent';
type SetupDepth = 'quick' | 'basic' | 'full';

const BASE_SYSTEM = `You are BG Ape, a friendly and knowledgeable board game companion.
You help players with game recommendations, setup guidance, rules explanations, and general board game questions.
When a "Recent conversation" block is provided, use it for continuity — do not re-ask questions already answered.

Always respond in valid JSON matching this exact structure:
{
  "type": "recommendation" | "quick_guide" | "generic",
  "title": "<concise title, max 10 words>",
  "summary": "<1-2 sentences introducing your response>",
  "bullets": ["<point 1>", "<point 2>", ...]
}

Bullets should be 3-6 items. Keep each bullet concise (1-2 sentences max).`;

const RECOMMENDATION_CONTEXT = `The user wants a game recommendation.
Consider player count, experience level, play time, complexity, category, and mechanics when mentioned.
Be specific — name real games and briefly explain why each fits the request.
When a "User collection" block is provided:
- If they asked to suggest only from their collection, pick exclusively from that list.
- Otherwise treat the list as familiarity context (owned games, play counts, recency).
Honour any Activity preference line (fresh / favorites / recent) using playCount and last-play age.
Use type "recommendation".`;

const RULES_CONTEXT = `The user has a rules question about a specific game.
Be precise. Reference specific mechanics, card names, or phases if mentioned.
When a "Focused game" block is provided, use its player count, time, weight, categories, and mechanics as ground truth.
If no focused-game metadata is provided, answer for the most common / standard ruleset and state that assumption briefly.
If the question is ambiguous or you're unsure, say so honestly.
Use type "generic".`;

const GENERAL_CONTEXT = `The user has a general board game question.
Choose the most fitting type: "recommendation" for game suggestions,
"quick_guide" for setup/how-to-play, "generic" for everything else.`;

const SETUP_FALLBACK = `No structured game metadata was provided. Give the most common standard setup at a typical default player count for that game. Avoid variants and advanced scenarios. Briefly state the player-count assumption in the summary.`;

const SETUP_WITH_CONTEXT = `When a "Focused game" block is provided, use its player count, time, weight, categories, and mechanics as ground truth for setup.`;

function setupReasonContext(depth: SetupDepth | undefined, hasGameContext: boolean): string {
  const resolved: SetupDepth = depth ?? 'basic';
  const depthPart =
    resolved === 'quick'
      ? `Keep it to the absolute minimum to start the first turn (about 5 minutes): board layout, starting resources, who goes first, and what a turn looks like. Skip scoring, edge cases, and advanced rules.`
      : resolved === 'full'
        ? `Give a complete rules walkthrough: full setup, turn structure, key actions, scoring, and important edge cases. Stay structured and numbered; still prefer clarity over encyclopedic detail.`
        : `Walk through the core loop so everyone understands the basics (about 15 minutes): setup, a typical turn, how to win, and the most important rules. Skip rare edge cases and optional variants.`;

  const metaPart = hasGameContext ? SETUP_WITH_CONTEXT : SETUP_FALLBACK;

  return `The user wants help setting up a specific game quickly.
${depthPart}
${metaPart}
Use type "quick_guide".`;
}

const CLARIFYING_GUIDANCE = `
This is the user's FIRST message. If their request lacks the key detail needed to answer well
(e.g. no player count for a recommendation, no game name for setup/rules), ask 1-2 targeted
clarifying questions in the bullets instead of guessing. Use:
  "type": "generic",
  "title": "A couple of quick questions" (or similar),
and list the questions as bullets.
If there is already enough detail, answer directly.`;

export type BuildSystemPromptOptions = {
  setupDepth?: SetupDepth;
  hasGameContext?: boolean;
};

export function buildSystemPrompt(
  reason: ChatReason,
  isFirstMessage: boolean,
  options: BuildSystemPromptOptions = {},
): string {
  const hasGameContext = options.hasGameContext === true;
  let reasonPart: string;
  if (reason === 'setup') {
    reasonPart = setupReasonContext(options.setupDepth, hasGameContext);
  } else if (reason === 'rules') {
    reasonPart = RULES_CONTEXT;
  } else if (reason === 'recommendation') {
    reasonPart = RECOMMENDATION_CONTEXT;
  } else {
    reasonPart = GENERAL_CONTEXT;
  }
  return `${BASE_SYSTEM}\n\n${reasonPart}${isFirstMessage ? CLARIFYING_GUIDANCE : ''}`;
}

type CollectionItem = {
  name: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  averageWeight?: number;
  categories?: string[];
  mechanics?: string[];
  playCount?: number;
  daysSinceLastPlay?: number;
};

function formatItemLine(g: CollectionItem): string {
  const bits: string[] = [g.name];
  if (g.minPlayers !== undefined || g.maxPlayers !== undefined) {
    bits.push(`${g.minPlayers ?? '?'}–${g.maxPlayers ?? '?'}p`);
  }
  if (g.playingTime !== undefined) bits.push(`${g.playingTime}m`);
  if (g.averageWeight !== undefined) bits.push(`w${g.averageWeight}`);
  const tags = [...(g.mechanics ?? []), ...(g.categories ?? [])];
  if (tags.length > 0) bits.push(tags.join('/'));
  if (g.playCount !== undefined) {
    const last =
      g.daysSinceLastPlay === undefined
        ? 'never'
        : g.daysSinceLastPlay === 0
          ? 'today'
          : `${g.daysSinceLastPlay}d`;
    bits.push(`plays:${g.playCount},last:${last}`);
  }
  return `- ${bits.join(' · ')}`;
}

/** Formats the compact collection snapshot for the model user turn. */
export function formatCollectionContextForModel(
  items: CollectionItem[],
  activityBias: ActivityBias = 'none',
): string {
  if (items.length === 0) return '';

  const biasLine =
    activityBias === 'undereplayed'
      ? 'Activity preference: prefer underexposed / less-played games.'
      : activityBias === 'favorites'
        ? 'Activity preference: prefer frequently played favorites.'
        : activityBias === 'recent'
          ? 'Activity preference: prefer games played recently.'
          : null;

  return [
    `User collection (${items.length} base games):`,
    ...items.map(formatItemLine),
    ...(biasLine ? [biasLine] : []),
  ].join('\n');
}

/** Formats a single focused game for setup/rules turns. */
export function formatGameContextForModel(game: CollectionItem): string {
  return ['Focused game:', formatItemLine(game)].join('\n');
}

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Formats prior turns for the model (current user message is separate). */
export function formatConversationHistoryForModel(history: HistoryMessage[]): string {
  if (history.length === 0) return '';
  const lines = history.map((m) => {
    const label = m.role === 'user' ? 'User' : 'Assistant';
    return `${label}: ${m.content}`;
  });
  return ['Recent conversation:', ...lines].join('\n');
}
