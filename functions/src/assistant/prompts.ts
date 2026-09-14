type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';
type ActivityBias = 'none' | 'undereplayed' | 'favorites' | 'recent';

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

const REASON_CONTEXT: Record<ChatReason, string> = {
  recommendation: `The user wants a game recommendation.
Consider player count, experience level, play time, complexity, category, and mechanics when mentioned.
Be specific — name real games and briefly explain why each fits the request.
When a "User collection" block is provided:
- If they asked to suggest only from their collection, pick exclusively from that list.
- Otherwise treat the list as familiarity context (owned games, play counts, recency).
Honour any Activity preference line (fresh / favorites / recent) using playCount and last-play age.
Use type "recommendation".`,

  setup: `The user wants help setting up a specific game quickly.
Provide clear, numbered setup steps. Focus on what's needed to start playing:
starting resources, player order, first-turn reminders. Skip optional advanced rules.
Use type "quick_guide".`,

  rules: `The user has a rules question about a specific game.
Be precise. Reference specific mechanics, card names, or phases if mentioned.
If the question is ambiguous or you're unsure, say so honestly.
Use type "generic".`,

  general: `The user has a general board game question.
Choose the most fitting type: "recommendation" for game suggestions,
"quick_guide" for setup/how-to-play, "generic" for everything else.`,
};

const CLARIFYING_GUIDANCE = `
This is the user's FIRST message. If their request lacks the key detail needed to answer well
(e.g. no player count for a recommendation, no game name for setup/rules), ask 1-2 targeted
clarifying questions in the bullets instead of guessing. Use:
  "type": "generic",
  "title": "A couple of quick questions" (or similar),
and list the questions as bullets.
If there is already enough detail, answer directly.`;

export function buildSystemPrompt(reason: ChatReason, isFirstMessage: boolean): string {
  const reasonPart = REASON_CONTEXT[reason] ?? REASON_CONTEXT.general;
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

/** Formats the compact collection snapshot for the model user turn. */
export function formatCollectionContextForModel(
  items: CollectionItem[],
  activityBias: ActivityBias = 'none',
): string {
  if (items.length === 0) return '';

  const lines = items.map((g) => {
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
  });

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
    ...lines,
    ...(biasLine ? [biasLine] : []),
  ].join('\n');
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
