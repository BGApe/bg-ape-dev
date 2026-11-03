import type { MyListItemId, UserId } from '@/types';

/** A game the player wants to play later. Stored at users/{uid}/myList/{itemId}. */
export type MyListItem = {
  id: MyListItemId;
  userId: UserId;
  name: string;
  note?: string;
  createdAt: number;
};

export type NewMyListItem = {
  name: string;
  note?: string;
};

export type MyListItemPatch = {
  note?: string;
};
