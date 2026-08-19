import type { GameId, MessageId, ThreadId, UserId } from '@/types';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatIntent = 'recommendation' | 'quick_guide' | 'generic';

/**
 * The purpose of a conversation. Set when the thread is created (often from a
 * contextual entry point, e.g. a "quick setup" button on a game). Used to label
 * and group conversations and, in future, to seed the assistant's behaviour.
 */
export type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';

export type ChatThread = {
  id: ThreadId;
  userId: UserId;
  title: string;
  reason: ChatReason;
  createdAt: number;
  updatedAt: number;
  /** Linked collection game, when the conversation is about a specific game. */
  gameId?: GameId;
  /** Denormalized game name for list display without a join. */
  gameName?: string;
  /** Short preview of the most recent message, for the conversation list. */
  lastMessagePreview?: string;
};

/** Caller-supplied fields when starting a conversation; ids/dates are assigned by the repo. */
export type NewChatThread = {
  title: string;
  reason: ChatReason;
  gameId?: GameId;
  gameName?: string;
};

/** Mutable thread fields (rename, activity bumps). */
export type ChatThreadPatch = {
  title?: string;
  updatedAt?: number;
  lastMessagePreview?: string;
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
