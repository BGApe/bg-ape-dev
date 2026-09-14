import type { ChatMessage } from '@/features/chat/types';

import type { AssistantHistoryMessage, ConversationHistoryLevel } from '../types';

const LEVEL_CONFIG: Record<
  ConversationHistoryLevel,
  { maxMessages: number; maxCharsPerMessage: number }
> = {
  minimal: { maxMessages: 2, maxCharsPerMessage: 400 },
  optimal: { maxMessages: 6, maxCharsPerMessage: 500 },
  maximal: { maxMessages: 20, maxCharsPerMessage: 1_000 },
};

/** Default production window — last ~3 turns. */
export const DEFAULT_CONVERSATION_HISTORY_LEVEL: ConversationHistoryLevel = 'optimal';

function truncate(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

/**
 * Builds prior-turn history for the assistant (excludes the current user message,
 * which is sent separately as `text`).
 *
 * Only `user` / `assistant` roles are included; optimistic rows are skipped.
 */
export function buildConversationHistory(
  messages: ChatMessage[],
  level: ConversationHistoryLevel = DEFAULT_CONVERSATION_HISTORY_LEVEL,
): AssistantHistoryMessage[] {
  const { maxMessages, maxCharsPerMessage } = LEVEL_CONFIG[level];

  const eligible = messages.filter(
    (m) =>
      !m.isOptimistic &&
      (m.role === 'user' || m.role === 'assistant') &&
      m.content.trim().length > 0,
  );

  const window = eligible.slice(-maxMessages);

  return window.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: truncate(m.content, maxCharsPerMessage),
  }));
}

/** Formats history as a compact transcript prepended before the latest user turn. */
export function formatConversationHistoryBlock(history: AssistantHistoryMessage[]): string {
  if (history.length === 0) return '';
  const lines = history.map((m) => {
    const label = m.role === 'user' ? 'User' : 'Assistant';
    return `${label}: ${m.content}`;
  });
  return ['Recent conversation:', ...lines].join('\n');
}
