import type { ThreadId, UserId } from '@/types';

import type { ChatMessage, ChatThread } from '../types';

export interface ChatRepository {
  getOrCreateThread(uid: UserId): Promise<ChatThread>;
  addMessage(threadId: ThreadId, message: Omit<ChatMessage, 'id'>): Promise<ChatMessage>;
  getMessages(threadId: ThreadId): Promise<ChatMessage[]>;
}
