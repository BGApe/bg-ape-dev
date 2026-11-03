import { firestore } from '@/backend/firestore';
import { logger } from '@/services/logger';
import type { MyListItemId, UserId } from '@/types';

import { MyListItemSchema } from '../schemas';
import type { MyListItem, MyListItemPatch, NewMyListItem } from '../types';

import type { MyListRepository } from './MyListRepository';

const USERS = 'users';
const MY_LIST = 'myList';

function myListRef(uid: UserId) {
  return firestore().collection(USERS).doc(uid).collection(MY_LIST);
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

function toItem(data: {
  id: MyListItemId;
  userId: UserId;
  name: string;
  note?: string | undefined;
  createdAt: number;
}): MyListItem {
  const item: MyListItem = {
    id: data.id,
    userId: data.userId,
    name: data.name,
    createdAt: data.createdAt,
  };
  if (data.note !== undefined && data.note.length > 0) item.note = data.note;
  return item;
}

export const firestoreMyListRepository: MyListRepository = {
  async list(uid: UserId): Promise<MyListItem[]> {
    const snap = await myListRef(uid).orderBy('createdAt', 'desc').get();
    const items: MyListItem[] = [];
    for (const doc of snap.docs) {
      const parsed = MyListItemSchema.safeParse({ ...doc.data(), id: doc.id });
      if (!parsed.success) {
        logger.warn('[MyListRepo] Item schema mismatch, skipping', {
          id: doc.id,
          issues: parsed.error.issues,
        });
        continue;
      }
      items.push(
        toItem({
          ...parsed.data,
          id: parsed.data.id as MyListItemId,
          userId: parsed.data.userId as UserId,
        }),
      );
    }
    return items;
  },

  async add(uid: UserId, item: NewMyListItem): Promise<MyListItem> {
    const name = item.name.trim();
    const note = item.note?.trim();
    const existing = await myListRef(uid).get();
    const found = existing.docs.find(
      (doc) =>
        String(doc.data()['name'] ?? '')
          .trim()
          .toLowerCase() === name.toLowerCase(),
    );
    if (found !== undefined) {
      const parsed = MyListItemSchema.safeParse({ ...found.data(), id: found.id });
      if (parsed.success) {
        return toItem({
          ...parsed.data,
          id: parsed.data.id as MyListItemId,
          userId: parsed.data.userId as UserId,
        });
      }
    }

    const createdAt = Date.now();
    const ref = myListRef(uid).doc();
    const stored = compact({
      userId: uid,
      name,
      createdAt,
      ...(note !== undefined && note.length > 0 ? { note } : {}),
    });
    await ref.set(stored);
    return toItem({
      id: ref.id as MyListItemId,
      userId: uid,
      name,
      createdAt,
      ...(note !== undefined && note.length > 0 ? { note } : {}),
    });
  },

  async update(uid: UserId, itemId: MyListItemId, patch: MyListItemPatch): Promise<void> {
    const note = patch.note?.trim() ?? '';
    if (note.length === 0) {
      await myListRef(uid).doc(itemId).update({ note: firestore.FieldValue.delete() });
      return;
    }
    await myListRef(uid).doc(itemId).update({ note });
  },

  async remove(uid: UserId, itemId: MyListItemId): Promise<void> {
    await myListRef(uid).doc(itemId).delete();
  },
};
