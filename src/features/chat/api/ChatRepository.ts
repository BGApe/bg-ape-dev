import type { MessageId, ThreadId, UserId } from '@/types';

import type { ChatMessage, ChatThread, ChatThreadPatch, NewChatThread } from '../types';

/**
 * Chat persistence. Conversations live per-user (users/{uid}/threads/{threadId})
 * so a user can hold many labelled conversations. Every method takes the owner's
 * uid so the storage path and security scope stay explicit.
 */
export interface ChatRepository {
  listThreads(uid: UserId): Promise<ChatThread[]>;
  createThread(uid: UserId, input: NewChatThread): Promise<ChatThread>;
  updateThread(uid: UserId, threadId: ThreadId, patch: ChatThreadPatch): Promise<void>;
  deleteThread(uid: UserId, threadId: ThreadId): Promise<void>;

  addMessage(
    uid: UserId,
    threadId: ThreadId,
    message: Omit<ChatMessage, 'id'>,
  ): Promise<ChatMessage>;
  getMessages(uid: UserId, threadId: ThreadId): Promise<ChatMessage[]>;
  deleteMessage(uid: UserId, threadId: ThreadId, messageId: MessageId): Promise<void>;
  clearMessages(uid: UserId, threadId: ThreadId): Promise<void>;
}
