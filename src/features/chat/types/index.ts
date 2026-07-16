import type { MessageId, ThreadId, UserId } from '@/types';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatIntent = 'recommendation' | 'quick_guide' | 'generic';

export type ChatThread = {
  id: ThreadId;
  userId: UserId;
  createdAt: number;
  updatedAt: number;
};

export type ChatMessage = {
  id: MessageId;
  threadId: ThreadId;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** Present only on client-side optimistic inserts — never persisted. */
  isOptimistic?: true;
};
