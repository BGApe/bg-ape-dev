import type { GameId, MessageId, ThreadId, UserId } from '@/types';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatIntent = 'recommendation' | 'quick_guide' | 'generic';

/**
 * The purpose of a conversation. Set when the thread is created (often from a
 * contextual entry point, e.g. a "quick setup" button on a game). Used to label
 * and group conversations and, in future, to seed the assistant's behaviour.
 */
export type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';

/** A saved discussion inside the one chat for a game. */
export type DiscussionKind = 'setup' | 'rules';

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
  /** Follow-up segments the user marked solved. Those messages render collapsed. */
  solvedSegmentIds?: string[];
  /**
   * Stable id for the one chat that belongs to a parent game.
   * Collection games use `game:{id}`. Typed names use `name:{lowercase}`.
   */
  gameKey?: string;
};

/** Caller-supplied fields when starting a conversation; ids/dates are assigned by the repo. */
export type NewChatThread = {
  title: string;
  reason: ChatReason;
  gameId?: GameId;
  gameName?: string;
  gameKey?: string;
};

/** Mutable thread fields. `null` clears an optional game link. */
export type ChatThreadPatch = {
  title?: string;
  reason?: ChatReason;
  updatedAt?: number;
  lastMessagePreview?: string;
  gameId?: GameId | null;
  gameName?: string | null;
  gameKey?: string;
  solvedSegmentIds?: string[];
};

export type ChatMessage = {
  id: MessageId;
  threadId: ThreadId;
  role: MessageRole;
  /** Full text sent to the assistant and stored for history. */
  content: string;
  createdAt: number;
  /** Short label shown in the bubble when `content` is a hidden follow-up prompt. */
  label?: string;
  /** Game titles attached to an assistant recommendation, used as reply buttons. */
  suggestedGames?: string[];
  /** Groups a follow-up question and its answers so they can collapse together. */
  segmentId?: string;
  /** Short title shown on the collapsed card, such as "Initial resources". */
  segmentTitle?: string;
  /** Sub-discussion inside a game's single chat (one version + setup or rules). */
  discussionId?: string;
  discussionTitle?: string;
  discussionKind?: DiscussionKind;
  /** Expansion or edition this discussion is about. The thread itself is the parent game. */
  versionName?: string;
  playerCount?: string;
  /** Present only on client-side optimistic inserts — never persisted. */
  isOptimistic?: true;
};

/** First message of a new setup or rules discussion, queued until the game chat opens. */
export type PendingTurn = {
  text: string;
  discussionId: string;
  discussionTitle: string;
  discussionKind: DiscussionKind;
  versionName: string;
  /** Set on a follow-up topic. The opening exchange stays unsegmented so it can collapse when the next topic starts. */
  segmentId?: string;
  segmentTitle?: string;
  playerCount?: string;
  label?: string;
};
