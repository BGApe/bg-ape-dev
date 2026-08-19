import type { MessageId, ThreadId, UserId } from '@/types';

import type { ChatMessage, ChatThread, ChatThreadPatch, NewChatThread } from '../types';

import type { ChatRepository } from './ChatRepository';

const PREVIEW_MAX = 120;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * In-memory multi-conversation chat repository — no Firestore dependency.
 * Selected via appConfig.chat.persistMessages (false → this, true → Firestore).
 */
export class InMemoryChatRepository implements ChatRepository {
  private readonly threads = new Map<string, ChatThread>();
  private readonly messages = new Map<string, ChatMessage[]>();

  listThreads(uid: UserId): Promise<ChatThread[]> {
    const list = [...this.threads.values()]
      .filter((t) => t.userId === uid)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return Promise.resolve(list);
  }

  createThread(uid: UserId, input: NewChatThread): Promise<ChatThread> {
    const now = Date.now();
    const thread: ChatThread = {
      id: generateId() as ThreadId,
      userId: uid,
      title: input.title,
      reason: input.reason,
      createdAt: now,
      updatedAt: now,
    };
    if (input.gameId !== undefined) thread.gameId = input.gameId;
    if (input.gameName !== undefined) thread.gameName = input.gameName;

    this.threads.set(thread.id, thread);
    this.messages.set(thread.id, []);
    return Promise.resolve(thread);
  }

  updateThread(_uid: UserId, threadId: ThreadId, patch: ChatThreadPatch): Promise<void> {
    const thread = this.threads.get(threadId);
    if (thread !== undefined) {
      this.threads.set(threadId, {
        ...thread,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.updatedAt !== undefined ? { updatedAt: patch.updatedAt } : {}),
        ...(patch.lastMessagePreview !== undefined
          ? { lastMessagePreview: patch.lastMessagePreview }
          : {}),
      });
    }
    return Promise.resolve();
  }

  deleteThread(_uid: UserId, threadId: ThreadId): Promise<void> {
    this.threads.delete(threadId);
    this.messages.delete(threadId);
    return Promise.resolve();
  }

  addMessage(
    _uid: UserId,
    threadId: ThreadId,
    message: Omit<ChatMessage, 'id'>,
  ): Promise<ChatMessage> {
    const id = generateId() as MessageId;
    const newMessage: ChatMessage = { ...message, id };

    const bucket = this.messages.get(threadId) ?? [];
    bucket.push(newMessage);
    this.messages.set(threadId, bucket);

    const thread = this.threads.get(threadId);
    if (thread !== undefined) {
      this.threads.set(threadId, {
        ...thread,
        updatedAt: Date.now(),
        lastMessagePreview: message.content.slice(0, PREVIEW_MAX),
      });
    }

    return Promise.resolve(newMessage);
  }

  getMessages(_uid: UserId, threadId: ThreadId): Promise<ChatMessage[]> {
    return Promise.resolve([...(this.messages.get(threadId) ?? [])]);
  }

  deleteMessage(_uid: UserId, threadId: ThreadId, messageId: MessageId): Promise<void> {
    const bucket = this.messages.get(threadId) ?? [];
    this.messages.set(
      threadId,
      bucket.filter((m) => m.id !== messageId),
    );
    return Promise.resolve();
  }

  clearMessages(_uid: UserId, threadId: ThreadId): Promise<void> {
    this.messages.set(threadId, []);
    return Promise.resolve();
  }
}

export const inMemoryChatRepository = new InMemoryChatRepository();
