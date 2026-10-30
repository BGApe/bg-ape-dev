import { create } from 'zustand';

import type { DiscussionKind, PendingTurn } from '@/features/chat/types';

/**
 * Cross-screen chat navigation state.
 *
 * - `activeThreadId`: set before navigating to the Chat tab so ConversationList can
 *   auto-open the correct thread.
 * - `pendingMessage`: optional first message to auto-send when the Conversation
 *   mounts. The intent screen stores the constructed prompt here so the assistant
 *   starts responding immediately after the thread is created.
 */
type ChatUiState = {
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  pendingMessage: string | null;
  setPendingMessage: (msg: string | null) => void;
  /** Prompt already handed to the open conversation, so a remount cannot send it again. */
  consumedPending: string | null;
  tryConsumePending: (expected: string) => boolean;
  /** When set, a game chat shows only setup or only rules discussions. */
  discussionFilter: DiscussionKind | null;
  setDiscussionFilter: (filter: DiscussionKind | null) => void;
  pendingTurn: PendingTurn | null;
  setPendingTurn: (turn: PendingTurn | null) => void;
  tryConsumePendingTurn: (turn: PendingTurn) => boolean;
};

export const useChatUiStore = create<ChatUiState>()((set, get) => ({
  activeThreadId: null,
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
  pendingMessage: null,
  consumedPending: null,
  discussionFilter: null,
  setDiscussionFilter: (discussionFilter) => set({ discussionFilter }),
  pendingTurn: null,
  setPendingTurn: (pendingTurn) =>
    set({
      pendingTurn,
      consumedPending: pendingTurn === null ? get().consumedPending : null,
    }),
  tryConsumePendingTurn: (turn) => {
    const current = get().pendingTurn;
    const token = `${turn.discussionId}\u0000${turn.text}`;
    if (
      current === null ||
      current.discussionId !== turn.discussionId ||
      current.text !== turn.text ||
      get().consumedPending === token
    ) {
      return false;
    }
    set({ pendingTurn: null, consumedPending: token });
    return true;
  },
  setPendingMessage: (pendingMessage) =>
    set({
      pendingMessage,
      consumedPending: pendingMessage === null ? get().consumedPending : null,
    }),
  tryConsumePending: (expected) => {
    const { pendingMessage, consumedPending } = get();
    if (pendingMessage !== expected || consumedPending === expected) return false;
    set({ pendingMessage: null, consumedPending: expected });
    return true;
  },
}));
