import type { AssistantResponse } from '@/features/assistant/types';
import type { MessageId, ThreadId } from '@/types';

import { extractSuggestedGames } from '../lib/suggestedGames';
import type { ChatMessage } from '../types';

/** Drops a title, summary, or bullet that repeats text already in the answer. */
export function formatAssistantContent(response: AssistantResponse): string {
  const seen = new Set<string>();
  const take = (text: string): string | null => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return null;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return trimmed;
  };

  const prose = [take(response.title), take(response.summary)].filter(
    (part): part is string => part !== null,
  );
  const bullets = response.bullets
    .map((bullet) => take(bullet))
    .filter((bullet): bullet is string => bullet !== null)
    .map((bullet) => `• ${bullet}`);
  const bulletBlock = bullets.join('\n');
  return [...prose, ...(bulletBlock.length > 0 ? [bulletBlock] : [])].join('\n\n');
}

export function assistantResponseToChatMessages(
  response: AssistantResponse,
  threadId: ThreadId,
): ChatMessage[] {
  const content = formatAssistantContent(response);

  const suggestedGames = extractSuggestedGames(response);
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}` as MessageId,
    threadId,
    role: 'assistant',
    content,
    createdAt: Date.now(),
    ...(suggestedGames.length > 0 ? { suggestedGames } : {}),
  };

  return [message];
}
