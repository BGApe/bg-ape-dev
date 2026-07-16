import type { MessageId, ThreadId, UserId } from '@/types';

import type { ChatMessage, ChatThread } from '../types';

import type { ChatRepository } from './ChatRepository';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Default in-memory chat repository — no Firestore dependency.
 * Flip to FirestoreChatRepository via featureFlags.chat.persistMessages (Phase 3+).
 */
export class InMemoryChatRepository implements ChatRepository {
  private readonly threads = new Map<string, ChatThread>();
  private readonly messages = new Map<string, ChatMessage[]>();
  private readonly userThreadIndex = new Map<string, string>();

  getOrCreateThread(uid: UserId): Promise<ChatThread> {
    const existing = this.userThreadIndex.get(uid);
    if (existing !== undefined) {
      const thread = this.threads.get(existing);
      if (thread !== undefined) return Promise.resolve(thread);
    }

    const now = Date.now();
    const threadId = generateId() as ThreadId;
    const thread: ChatThread = { id: threadId, userId: uid, createdAt: now, updatedAt: now };

    this.threads.set(threadId, thread);
    this.messages.set(threadId, []);
    this.userThreadIndex.set(uid, threadId);

    return Promise.resolve(thread);
  }

  addMessage(threadId: ThreadId, message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
    const id = generateId() as MessageId;
    const newMessage: ChatMessage = { ...message, id };

    const bucket = this.messages.get(threadId) ?? [];
    bucket.push(newMessage);
    this.messages.set(threadId, bucket);

    const thread = this.threads.get(threadId);
    if (thread !== undefined) {
      this.threads.set(threadId, { ...thread, updatedAt: Date.now() });
    }

    return Promise.resolve(newMessage);
  }

  getMessages(threadId: ThreadId): Promise<ChatMessage[]> {
    return Promise.resolve([...(this.messages.get(threadId) ?? [])]);
  }
}

export const inMemoryChatRepository = new InMemoryChatRepository();
