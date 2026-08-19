import type { ChatIntent, ChatReason } from '@/features/chat/types';

export type AssistantResponseType = ChatIntent;

export type AssistantRequest = {
  text: string;
  intent: ChatIntent;
  /** Thread reason — drives clarifying-question behaviour. */
  threadReason: ChatReason;
  /** True when this is the user's very first message in the thread. */
  isFirstMessage: boolean;
};

export type AssistantResponse = {
  type: AssistantResponseType;
  title: string;
  summary: string;
  bullets: string[];
  metadata?: Record<string, unknown>;
};

export type AssistantChunk = {
  delta: string;
  done: boolean;
};
