import { create } from 'zustand';

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
};

export const useChatUiStore = create<ChatUiState>()((set) => ({
  activeThreadId: null,
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
  pendingMessage: null,
  setPendingMessage: (pendingMessage) => set({ pendingMessage }),
}));
