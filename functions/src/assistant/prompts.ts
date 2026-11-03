type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';
type ActivityBias = 'none' | 'undereplayed' | 'favorites' | 'recent';
type SetupDepth = 'quick' | 'basic' | 'full';

const BASE_SYSTEM = `You are BG Ape, a friendly and knowledgeable board game companion.
You help players with game recommendations, setup guidance, rules explanations, and general board game questions.
When a "Recent conversation" block is provided, use it for continuity — do not re-ask questions already answered.
Never repeat the user's message, earlier prompts, or your own draft wording. Answer once, in the final JSON only.

Always respond in valid JSON matching this exact structure:
{
  "type": "recommendation" | "quick_guide" | "generic",
  "title": "<concise title, max 10 words>",
  "summary": "<1-2 sentences introducing your response>",
  "bullets": ["<point 1>", "<point 2>", ...],
  "suggestedGames": ["<exact game title>", ...]
}

Bullets should be 3-6 items. Keep each bullet concise (1-2 sentences max).
suggestedGames lists up to 5 exact game titles (name only, no description).
For a recommendation, suggest exactly 5 games. Put each one in suggestedGames, and start each bullet with that title.
When you are only asking clarifying questions, or the reply is not naming games, return an empty array.`;

const RECOMMENDATION_CONTEXT = `The user wants a game recommendation.
Consider player count, experience level, play time, complexity, category, and mechanics when mentioned.
Euro-style means economic systems, point-salad scoring, resource management, low direct player interaction, and luck mitigation.
Ameritrash-style means miniatures or figures, fighting enemies, dice rolling, and high-luck decisions.
When the user asks for one of those styles, favour that cluster even if they also name a single tag.
Be specific — name real games and briefly explain why each fits the request.
When the user names games to avoid, do not suggest any of those titles again.
When a "User collection" block is provided:
- If they asked to suggest only from their collection, pick all 5 exclusively from that list.
- Otherwise you may include one or two games from that list when they fit, but most of the 5 suggestions must be games that are not in the collection.
- Also use the list as familiarity context (owned games, play counts, recency).
Honour any Activity preference line (fresh / favorites / recent) using playCount and last-play age.
Use type "recommendation".`;

const RULES_CONTEXT = `The user has a rules question about a specific game.
Be precise. Reference specific mechanics, card names, or phases if mentioned.
Answer from the base game and its expansions together. When a card, score, or rule exists only in an expansion, name that expansion and say it is not in the base game.
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
      ? `This is the 5-minute start. Give the bare minimum to begin the first turn: essential mechanics and the minimum table setup. Use only pieces required every game. Leave out optional expansions and modules, and name what you left out in one short line. Skip scoring edge cases and variants.`
      : resolved === 'full'
        ? `This is the full rules walkthrough. Ignore the usual 3-6 bullet limit. Write one bullet per section, and start that bullet with a markdown heading line exactly like ## Table setup, then a short paragraph and bullet points. Cover what must be present every game versus what is chosen for a different experience; where components and resources go and what they are used for; the turn or phase flow, including attacks and reactions; each major action in its own section with one short example; scoring conditions; and how different sets or modules change the pace. Keep each section concise. Do not merge them into one paragraph.`
        : `This is the 15-minute core-rules pass. Cover where each component goes and which figures, characters, and resources each player takes. Then give a basic overview of the core rules, the main mechanics, and how scoring works. Skip rare exceptions and optional modules.`;

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
and list the questions as bullets. Return suggestedGames as an empty array.
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
