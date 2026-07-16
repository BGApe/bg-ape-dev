import { create } from 'zustand';

type ComposerState = {
  draft: string;
  isSending: boolean;
  /** Accumulates streaming assistant chunks before the final message is committed. */
  streamingContent: string;
  setDraft: (draft: string) => void;
  setIsSending: (sending: boolean) => void;
  appendStreamChunk: (chunk: string) => void;
  clearStream: () => void;
};

export const useComposerStore = create<ComposerState>()((set) => ({
  draft: '',
  isSending: false,
  streamingContent: '',
  setDraft: (draft) => set({ draft }),
  setIsSending: (isSending) => set({ isSending }),
  appendStreamChunk: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),
  clearStream: () => set({ streamingContent: '' }),
}));
