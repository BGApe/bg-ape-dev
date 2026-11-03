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
type RawThread = Omit<
  ChatThread,
  'gameId' | 'gameName' | 'lastMessagePreview' | 'solvedSegmentIds' | 'gameKey'
> & {
  gameId?: GameId | undefined;
  gameName?: string | undefined;
  lastMessagePreview?: string | undefined;
  solvedSegmentIds?: string[] | undefined;
  gameKey?: string | undefined;
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
  if (data.solvedSegmentIds !== undefined && data.solvedSegmentIds.length > 0) {
    thread.solvedSegmentIds = data.solvedSegmentIds;
  }
  if (data.gameKey !== undefined && data.gameKey.length > 0) thread.gameKey = data.gameKey;
  return thread;
}

function copyDiscussionFields(
  target: ChatMessage,
  source: {
    discussionId?: string | undefined;
    discussionTitle?: string | undefined;
    discussionKind?: ChatMessage['discussionKind'] | undefined;
    versionName?: string | undefined;
    playerCount?: string | undefined;
  },
): void {
  if (source.discussionId !== undefined && source.discussionId.length > 0) {
    target.discussionId = source.discussionId;
  }
  if (source.discussionTitle !== undefined && source.discussionTitle.trim().length > 0) {
    target.discussionTitle = source.discussionTitle.trim();
  }
  if (source.discussionKind !== undefined) target.discussionKind = source.discussionKind;
  if (source.versionName !== undefined && source.versionName.trim().length > 0) {
    target.versionName = source.versionName.trim();
  }
  if (source.playerCount !== undefined && source.playerCount.length > 0) {
    target.playerCount = source.playerCount;
  }
}

function threadPatchPayload(patch: ChatThreadPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload['title'] = patch.title;
  if (patch.reason !== undefined) payload['reason'] = patch.reason;
  if (patch.updatedAt !== undefined) payload['updatedAt'] = patch.updatedAt;
  if (patch.lastMessagePreview !== undefined)
    payload['lastMessagePreview'] = patch.lastMessagePreview;
  if (patch.solvedSegmentIds !== undefined) payload['solvedSegmentIds'] = patch.solvedSegmentIds;
  if (patch.gameKey !== undefined) payload['gameKey'] = patch.gameKey;
  if (patch.gameId === null) payload['gameId'] = firestore.FieldValue.delete();
  else if (patch.gameId !== undefined) payload['gameId'] = patch.gameId;
  if (patch.gameName === null) payload['gameName'] = firestore.FieldValue.delete();
  else if (patch.gameName !== undefined) payload['gameName'] = patch.gameName;
  return payload;
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
          solvedSegmentIds: parsed.data.solvedSegmentIds,
          gameKey: parsed.data.gameKey,
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
      gameKey: input.gameKey,
    };
    await ref.set(compact(base));

    return toThread({ ...base, id: ref.id as ThreadId });
  },

  async updateThread(uid: UserId, threadId: ThreadId, patch: ChatThreadPatch): Promise<void> {
    const payload = threadPatchPayload(patch);
    if (Object.keys(payload).length === 0) return;
    await threadsRef(uid).doc(threadId).update(payload);
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
    const payload = compact({
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      label: message.label,
      suggestedGames: message.suggestedGames,
      segmentId: message.segmentId,
      segmentTitle: message.segmentTitle,
      parentSegmentId: message.parentSegmentId,
      discussionId: message.discussionId,
      discussionTitle: message.discussionTitle,
      discussionKind: message.discussionKind,
      versionName: message.versionName,
      playerCount: message.playerCount,
    });

    const msgRef = messagesRef(uid, threadId).doc();
    await msgRef.set(payload);

    // Best-effort activity bump + preview; must not lose the message on failure.
    try {
      await threadsRef(uid)
        .doc(threadId)
        .update({
          updatedAt: Date.now(),
          lastMessagePreview: (message.label ?? message.content).slice(0, PREVIEW_MAX),
        });
    } catch (error) {
      logger.warn('[FirestoreChatRepo] Failed to bump thread metadata', { threadId, error });
    }

    const stored: ChatMessage = {
      id: msgRef.id as MessageId,
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
    if (message.label !== undefined && message.label.length > 0) stored.label = message.label;
    if (message.suggestedGames !== undefined && message.suggestedGames.length > 0) {
      stored.suggestedGames = message.suggestedGames;
    }
    if (message.segmentId !== undefined && message.segmentId.length > 0) {
      stored.segmentId = message.segmentId;
    }
    if (message.segmentTitle !== undefined && message.segmentTitle.length > 0) {
      stored.segmentTitle = message.segmentTitle;
    }
    if (message.parentSegmentId !== undefined && message.parentSegmentId.length > 0) {
      stored.parentSegmentId = message.parentSegmentId;
    }
    copyDiscussionFields(stored, message);
    return stored;
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
      const suggestedGames = (parsed.data.suggestedGames ?? [])
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .slice(0, 5);
      const stored: ChatMessage = {
        id: parsed.data.id as MessageId,
        threadId: parsed.data.threadId as ThreadId,
        role: parsed.data.role,
        content: parsed.data.content,
        createdAt: parsed.data.createdAt,
      };
      if (parsed.data.label !== undefined && parsed.data.label.trim().length > 0) {
        stored.label = parsed.data.label.trim();
      }
      if (suggestedGames.length > 0) stored.suggestedGames = suggestedGames;
      if (parsed.data.segmentId !== undefined && parsed.data.segmentId.length > 0) {
        stored.segmentId = parsed.data.segmentId;
      }
      if (parsed.data.segmentTitle !== undefined && parsed.data.segmentTitle.trim().length > 0) {
        stored.segmentTitle = parsed.data.segmentTitle.trim();
      }
      if (parsed.data.parentSegmentId !== undefined && parsed.data.parentSegmentId.length > 0) {
        stored.parentSegmentId = parsed.data.parentSegmentId;
      }
      copyDiscussionFields(stored, parsed.data);
      messages.push(stored);
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
