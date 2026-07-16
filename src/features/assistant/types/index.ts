import type { ChatIntent } from '@/features/chat/types';

export type AssistantResponseType = ChatIntent;

export type AssistantRequest = {
  text: string;
  intent: ChatIntent;
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
