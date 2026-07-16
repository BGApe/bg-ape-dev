import type { AssistantResponse } from '@/features/assistant/types';
import type { MessageId, ThreadId } from '@/types';

import type { ChatMessage } from '../types';

/**
 * Converts an AssistantResponse into a single ChatMessage for persistence and display.
 * Formats title + summary + bullets into a readable plain-text content string.
 */
export function assistantResponseToChatMessages(
  response: AssistantResponse,
  threadId: ThreadId,
): ChatMessage[] {
  const bulletLines = response.bullets.map((b) => `• ${b}`).join('\n');
  const content = `${response.title}\n\n${response.summary}\n\n${bulletLines}`;

  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}` as MessageId,
    threadId,
    role: 'assistant',
    content,
    createdAt: Date.now(),
  };

  return [message];
}
