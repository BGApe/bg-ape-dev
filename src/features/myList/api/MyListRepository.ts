import type { MyListItemId, UserId } from '@/types';

import type { MyListItem, MyListItemPatch, NewMyListItem } from '../types';

/** Saved games the player wants to play later. Lives at users/{uid}/myList/{itemId}. */
export interface MyListRepository {
  list(uid: UserId): Promise<MyListItem[]>;
  add(uid: UserId, item: NewMyListItem): Promise<MyListItem>;
  update(uid: UserId, itemId: MyListItemId, patch: MyListItemPatch): Promise<void>;
  remove(uid: UserId, itemId: MyListItemId): Promise<void>;
}
