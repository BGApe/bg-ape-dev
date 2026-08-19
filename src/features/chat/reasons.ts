import type { ChatReason } from './types';

/** Display order for reason pickers. */
export const REASON_ORDER: readonly ChatReason[] = ['recommendation', 'setup', 'rules', 'general'];

/** Emoji glyph per reason (visual only — labels live in Copy.chat.reasons). */
export const REASON_EMOJI: Record<ChatReason, string> = {
  recommendation: '🎯',
  setup: '🧩',
  rules: '📖',
  general: '💬',
};
