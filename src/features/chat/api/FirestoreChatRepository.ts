import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { GameId, MessageId, ThreadId, UserId } from '@/types';

import { ChatMessageSchema, ChatThreadSchema } from '../schemas';
import type { ChatMessage, ChatThread, ChatThreadPatch, NewChatThread } from '../types';

import type { ChatRepository } from './ChatRepository';

const USERS = 'users';
const THREADS = 'threads';
const MESSAGES = 'messages';
const PREVIEW_MAX = 120;

function threadsRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(THREADS);
}

function messagesRef(uid: UserId, threadId: ThreadId) {
  return threadsRef(uid).doc(threadId).collection(MESSAGES);
}

/** Drops keys whose value is undefined (Firestore rejects undefined values). */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/** Loose shape for building a thread — optionals may be explicitly undefined. */
type RawThread = Omit<ChatThread, 'gameId' | 'gameName' | 'lastMessagePreview'> & {
  gameId?: GameId | undefined;
  gameName?: string | undefined;
  lastMessagePreview?: string | undefined;
};

/** Rebuilds a typed ChatThread from a validated doc, omitting absent optionals. */
function toThread(data: RawThread): ChatThread {
  const thread: ChatThread = {
    id: data.id,
    userId: data.userId,
    title: data.title,
    reason: data.reason,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
  if (data.gameId !== undefined) thread.gameId = data.gameId;
  if (data.gameName !== undefined) thread.gameName = data.gameName;
  if (data.lastMessagePreview !== undefined) thread.lastMessagePreview = data.lastMessagePreview;
  return thread;
}

/**
 * Firestore-backed multi-conversation chat.
 * Threads: users/{uid}/threads/{threadId}. Messages:
 * users/{uid}/threads/{threadId}/messages/{messageId}. Owner security is the
 * top-level uid, covered by the users/{uid}/{document=**} rule.
 */
export const firestoreChatRepository: ChatRepository = {
  async listThreads(uid: UserId): Promise<ChatThread[]> {
    const snap = await threadsRef(uid).orderBy('updatedAt', 'desc').get();

    const threads: ChatThread[] = [];
    for (const doc of snap.docs) {
      const parsed = ChatThreadSchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[FirestoreChatRepo] Thread schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      threads.push(
        toThread({
          ...parsed.data,
          id: parsed.data.id as ThreadId,
          userId: parsed.data.userId as UserId,
          gameId: parsed.data.gameId as GameId | undefined,
        }),
      );
    }
    return threads;
  },

  async createThread(uid: UserId, input: NewChatThread): Promise<ChatThread> {
    const now = Date.now();
    const ref = threadsRef(uid).doc();
    const base = {
      userId: uid,
      title: input.title,
      reason: input.reason,
      createdAt: now,
      updatedAt: now,
      gameId: input.gameId,
      gameName: input.gameName,
    };
    await ref.set(compact(base));

    return toThread({ ...base, id: ref.id as ThreadId });
  },

  async updateThread(uid: UserId, threadId: ThreadId, patch: ChatThreadPatch): Promise<void> {
    await threadsRef(uid)
      .doc(threadId)
      .update(compact({ ...patch }));
  },

  async deleteThread(uid: UserId, threadId: ThreadId): Promise<void> {
    const msgs = await messagesRef(uid, threadId).get();
    if (!msgs.empty) {
      const batch = firestore().batch();
      for (const doc of msgs.docs) batch.delete(doc.ref);
      await batch.commit();
    }
    await threadsRef(uid).doc(threadId).delete();
  },

  async addMessage(
    uid: UserId,
    threadId: ThreadId,
    message: Omit<ChatMessage, 'id'>,
  ): Promise<ChatMessage> {
    const payload = {
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };

    const msgRef = messagesRef(uid, threadId).doc();
    await msgRef.set(payload);

    // Best-effort activity bump + preview; must not lose the message on failure.
    try {
      await threadsRef(uid)
        .doc(threadId)
        .update({
          updatedAt: Date.now(),
          lastMessagePreview: message.content.slice(0, PREVIEW_MAX),
        });
    } catch (error) {
      logger.warn('[FirestoreChatRepo] Failed to bump thread metadata', { threadId, error });
    }

    return { ...payload, id: msgRef.id as MessageId };
  },

  async getMessages(uid: UserId, threadId: ThreadId): Promise<ChatMessage[]> {
    const snap = await messagesRef(uid, threadId).orderBy('createdAt', 'asc').get();

    const messages: ChatMessage[] = [];
    for (const doc of snap.docs) {
      const parsed = ChatMessageSchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[FirestoreChatRepo] Message schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      messages.push({
        id: parsed.data.id as MessageId,
        threadId: parsed.data.threadId as ThreadId,
        role: parsed.data.role,
        content: parsed.data.content,
        createdAt: parsed.data.createdAt,
      });
    }
    return messages;
  },

  async deleteMessage(uid: UserId, threadId: ThreadId, messageId: MessageId): Promise<void> {
    await messagesRef(uid, threadId).doc(messageId).delete();
  },

  async clearMessages(uid: UserId, threadId: ThreadId): Promise<void> {
    const snap = await messagesRef(uid, threadId).get();
    if (snap.empty) return;

    const batch = firestore().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  },
};
