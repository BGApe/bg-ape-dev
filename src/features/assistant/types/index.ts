import type { ChatIntent, ChatReason } from '@/features/chat/types';

export type AssistantResponseType = ChatIntent;

/** How much collection metadata to send with a recommendation turn. */
export type CollectionContextLevel = 'minimal' | 'optimal' | 'maximal';

/** How many prior messages to send for multi-turn context. */
export type ConversationHistoryLevel = 'minimal' | 'optimal' | 'maximal';

/**
 * User preference for how play history should bias recommendations.
 * Encoded into the prompt + attached collection block.
 */
export type ActivityBias = 'none' | 'undereplayed' | 'favorites' | 'recent';

/** Compact per-game snapshot for the assistant (never send full CollectionGame docs). */
export type CollectionGameContextItem = {
  name: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  averageWeight?: number;
  categories?: string[];
  mechanics?: string[];
  playCount?: number;
  /** Days since last logged play; omit when never played. */
  daysSinceLastPlay?: number;
};

/** Prior turn for multi-turn context (current user text is separate). */
export type AssistantHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantRequest = {
  text: string;
  intent: ChatIntent;
  /** Thread reason — drives clarifying-question behaviour. */
  threadReason: ChatReason;
  /** True when this is the user's very first message in the thread. */
  isFirstMessage: boolean;
  /**
   * Compact owned-games snapshot for recommendation threads.
   * Omitted for setup/rules/general unless explicitly provided.
   */
  collectionContext?: CollectionGameContextItem[];
  /** How to weigh play history when suggesting games. */
  activityBias?: ActivityBias;
  /** Prior messages in this thread (optimal = last 6). */
  recentMessages?: AssistantHistoryMessage[];
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
