import { detectPlayerCount } from '@/features/assistant/lib/collectionContext';

import type { ChatMessage, DiscussionKind } from '../types';

import { discussionHeading, openingTopicTitle, versionNameFromPrompt } from './gameThread';

export type MessageBlock =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'segment'; id: string; title: string; messages: ChatMessage[] };

export type DiscussionGroup = {
  id: string;
  title: string;
  kind: DiscussionKind;
  versionName: string;
  playerCount?: string;
  messages: ChatMessage[];
};

export function newSegmentId(): string {
  return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Hides a prompt stored twice, including a full user-plus-answer replay. */
export function collapseRepeated(messages: ChatMessage[]): ChatMessage[] {
  const visible: ChatMessage[] = [];
  for (const message of messages) {
    const last = visible[visible.length - 1];
    if (last !== undefined && last.role === message.role && last.content === message.content) {
      continue;
    }
    visible.push(message);
  }
  return dropRepeatedExchanges(visible);
}

function dropRepeatedExchanges(messages: ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let index = 0;
  while (index < messages.length) {
    const current = messages[index];
    const next = messages[index + 1];
    if (
      current !== undefined &&
      next !== undefined &&
      current.role === 'user' &&
      next.role === 'assistant' &&
      kept.length >= 2
    ) {
      const previousAssistant = kept[kept.length - 1];
      const previousUser = kept[kept.length - 2];
      if (
        previousUser?.role === 'user' &&
        previousAssistant?.role === 'assistant' &&
        previousUser.content === current.content &&
        previousAssistant.content === next.content
      ) {
        index += 2;
        continue;
      }
    }
    if (current !== undefined) kept.push(current);
    index += 1;
  }
  return kept;
}

/**
 * Earlier topics collapse as soon as a later one starts.
 * The latest topic stays open unless it was marked solved.
 */
export function groupTopicRuns(
  messages: ChatMessage[],
  kind: DiscussionKind,
  forceClosedIds: readonly string[] = [],
): MessageBlock[] {
  const firstUser = messages.find((message) => message.role === 'user');
  const openingTitle = openingTopicTitle(kind, firstUser?.content ?? '');
  const runs: { id: string; title: string; messages: ChatMessage[] }[] = [];
  for (const message of messages) {
    const id = message.segmentId ?? 'opening';
    const title = message.segmentTitle ?? (id === 'opening' ? openingTitle : 'Follow-up');
    const last = runs[runs.length - 1];
    if (last !== undefined && last.id === id) {
      last.messages.push(message);
      if (message.segmentTitle !== undefined && message.segmentTitle.length > 0) {
        last.title = message.segmentTitle;
      }
      continue;
    }
    runs.push({ id, title, messages: [message] });
  }

  const lastId = runs[runs.length - 1]?.id;
  const forced = new Set(forceClosedIds);
  const blocks: MessageBlock[] = [];
  for (const run of runs) {
    const closed = run.id !== lastId || forced.has(run.id);
    if (!closed) {
      for (const message of run.messages) blocks.push({ kind: 'message', message });
      continue;
    }
    blocks.push({ kind: 'segment', id: run.id, title: run.title, messages: run.messages });
  }
  return blocks;
}

const LEGACY_DISCUSSION = 'legacy';

/** Groups a game chat into one container per version and question type. */
export function groupDiscussions(
  messages: ChatMessage[],
  fallback: { title: string; kind: DiscussionKind; versionName: string },
): DiscussionGroup[] {
  const groups: DiscussionGroup[] = [];
  for (const message of messages) {
    const id = message.discussionId ?? LEGACY_DISCUSSION;
    let group = groups.find((item) => item.id === id);
    if (group === undefined) {
      const kind = message.discussionKind ?? fallback.kind;
      group = {
        id,
        title: message.discussionTitle ?? fallback.title,
        kind,
        versionName: message.versionName ?? fallback.versionName,
        messages: [],
      };
      if (message.playerCount !== undefined) group.playerCount = message.playerCount;
      groups.push(group);
    }
    group.messages.push(message);
  }

  for (const group of groups) {
    const savedTitle = group.messages.some((message) => message.discussionTitle !== undefined);
    if (savedTitle) continue;
    const firstUser = group.messages.find((message) => message.role === 'user');
    const version =
      (firstUser !== undefined ? versionNameFromPrompt(firstUser.content) : undefined) ??
      group.versionName;
    const players =
      group.playerCount ??
      (firstUser !== undefined ? detectPlayerCount(firstUser.content) : undefined);
    group.versionName = version;
    if (players !== undefined) group.playerCount = players;
    group.title = discussionHeading(version, group.kind, players);
  }
  return groups;
}

/**
 * Folds messages that share a solved segment id into one collapsible block.
 * Unsolved follow-ups stay as normal messages so the chat can continue under them.
 */
export function groupSolvedSegments(
  messages: ChatMessage[],
  solvedSegmentIds: readonly string[],
): MessageBlock[] {
  const solved = new Set(solvedSegmentIds);
  const blocks: MessageBlock[] = [];
  let index = 0;
  while (index < messages.length) {
    const current = messages[index];
    if (current === undefined) break;
    const segmentId = current.segmentId;
    if (segmentId !== undefined && solved.has(segmentId)) {
      const grouped: ChatMessage[] = [];
      let title = current.segmentTitle ?? 'Solved';
      while (index < messages.length && messages[index]?.segmentId === segmentId) {
        const item = messages[index];
        if (item !== undefined) {
          grouped.push(item);
          if (item.segmentTitle !== undefined && item.segmentTitle.length > 0) {
            title = item.segmentTitle;
          }
        }
        index += 1;
      }
      blocks.push({ kind: 'segment', id: segmentId, title, messages: grouped });
      continue;
    }
    blocks.push({ kind: 'message', message: current });
    index += 1;
  }
  return blocks;
}
