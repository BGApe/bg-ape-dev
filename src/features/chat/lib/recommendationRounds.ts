import type { ChatMessage } from '../types';

import { parsePickerPrompt } from './pickerSummary';
import { previewSentences } from './previewText';

export type RecommendationTip = {
  id: string;
  name: string;
  preview: string;
  body: string;
  followups: ChatMessage[];
};

/** A follow-up such as "Easiest setup", nested under the original search. */
export type RecommendationTopic = {
  id: string;
  title: string;
  intro: string;
  tips: RecommendationTip[];
};

export type RecommendationRound = {
  id: string;
  /** The request that produced this set of tips. */
  query: string;
  /** Assistant prose that is not itself a tip. */
  intro: string;
  tips: RecommendationTip[];
  topics: RecommendationTopic[];
};

type TipBucket = {
  id: string;
  intro: string;
  tips: RecommendationTip[];
};

/**
 * A recommendation chat is one umbrella per request, with each suggested game
 * as a card underneath. A follow-up stamped with the game name stays on that card.
 */
export function groupRecommendationRounds(messages: ChatMessage[]): RecommendationRound[] {
  const rounds: RecommendationRound[] = [];
  let round: RecommendationRound | null = null;
  let topic: RecommendationTopic | null = null;

  for (const message of messages) {
    if (message.role === 'user' && message.segmentTitle === undefined) {
      const query = (message.label ?? message.content).trim();
      const anotherSearch = round !== null && parsePickerPrompt(message.content) !== null;
      if (round === null || anotherSearch) {
        round = { id: message.id, query, intro: '', tips: [], topics: [] };
        topic = null;
        rounds.push(round);
      } else {
        topic = { id: message.id, title: query, intro: '', tips: [] };
        round.topics.push(topic);
      }
      continue;
    }

    if (message.role !== 'assistant' || round === null) continue;

    if (message.segmentTitle !== undefined) {
      const tip = findTip(rounds, message.segmentTitle);
      if (tip !== undefined && message.content.trim().length > 0) tip.followups.push(message);
      continue;
    }

    fillBucket(topic ?? round, message);
  }

  return rounds.filter((item) => item.query.length > 0);
}

function fillBucket(bucket: TipBucket, message: ChatMessage): void {
  const names = tipNames(message);
  if (names.length === 0 || bucket.tips.length > 0) {
    const text = message.content.trim();
    if (text.length > 0 && names.length === 0) {
      bucket.intro = bucket.intro.length > 0 ? `${bucket.intro}\n\n${text}` : text;
    }
    return;
  }

  bucket.intro = introText(message.content, names);
  bucket.tips = names.map((name) => {
    const body = tipBody(message.content, name);
    return {
      id: `${bucket.id}:${name}`,
      name,
      preview: previewSentences(body, 2),
      body,
      followups: [],
    };
  });
}

function findTip(rounds: RecommendationRound[], name: string): RecommendationTip | undefined {
  const key = name.trim().toLowerCase();
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    const current = rounds[i];
    if (current === undefined) continue;
    const buckets = [...current.topics].reverse();
    for (const bucket of buckets) {
      const found = bucket.tips.find((tip) => tip.name.toLowerCase() === key);
      if (found !== undefined) return found;
    }
    const found = current.tips.find((tip) => tip.name.toLowerCase() === key);
    if (found !== undefined) return found;
  }
  return undefined;
}

const TIP_SPLIT = /\s[—–]\s|\s-\s|:\s/;

/** Stored titles, or the names written at the start of each bullet. */
function tipNames(message: ChatMessage): string[] {
  const stored = (message.suggestedGames ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (stored.length > 0) return stored.slice(0, 5);
  return titlesFromContent(message.content);
}

function titlesFromContent(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of content.split('\n')) {
    const line = cleanLine(raw);
    if (!TIP_SPLIT.test(line)) continue;
    const name = line.split(TIP_SPLIT)[0]?.trim();
    if (name === undefined || name.length === 0 || name.length > 40 || name.endsWith('?')) {
      continue;
    }
    if (name.split(/\s+/).length > 6) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === 5) break;
  }
  return names;
}

function cleanLine(raw: string): string {
  return raw
    .replace(/^•\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
}

function introText(content: string, games: string[]): string {
  const keys = games.map((game) => game.trim().toLowerCase()).filter((game) => game.length > 0);
  const kept: string[] = [];
  for (const raw of content.split('\n')) {
    const line = cleanLine(raw);
    if (line.length === 0) continue;
    const lower = line.toLowerCase();
    if (keys.some((name) => lower.startsWith(name))) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

function tipBody(content: string, game: string): string {
  const key = game.trim().toLowerCase();
  const hits: string[] = [];
  for (const raw of content.split('\n')) {
    const line = cleanLine(raw);
    if (line.length === 0) continue;
    if (line.toLowerCase().startsWith(key)) hits.push(line);
  }
  return hits.join('\n');
}
