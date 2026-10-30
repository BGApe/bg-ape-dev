import type { ChatThread, ChatThreadPatch } from '../types';

/** Applies a thread patch, treating `null` game fields as cleared. */
export function applyThreadPatch(thread: ChatThread, patch: ChatThreadPatch): ChatThread {
  const next: ChatThread = { ...thread };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.reason !== undefined) next.reason = patch.reason;
  if (patch.updatedAt !== undefined) next.updatedAt = patch.updatedAt;
  if (patch.lastMessagePreview !== undefined) next.lastMessagePreview = patch.lastMessagePreview;
  if (patch.solvedSegmentIds !== undefined) next.solvedSegmentIds = patch.solvedSegmentIds;
  if (patch.gameKey !== undefined) next.gameKey = patch.gameKey;
  if (patch.gameId === null) delete next.gameId;
  else if (patch.gameId !== undefined) next.gameId = patch.gameId;
  if (patch.gameName === null) delete next.gameName;
  else if (patch.gameName !== undefined) next.gameName = patch.gameName;
  return next;
}
