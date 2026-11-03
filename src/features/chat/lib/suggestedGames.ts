import type { AssistantResponse } from '@/features/assistant/types';

import type { ChatMessage } from '../types';

const MAX_SUGGESTIONS = 5;

/**
 * Titles for recommendation reply buttons.
 * Prefers the structured field. Falls back to "Name — reason" bullets.
 */
export function extractSuggestedGames(response: AssistantResponse): string[] {
  const fromField = uniqueNames(response.suggestedGames ?? []);
  if (response.type !== 'recommendation') return uniqueNames(fromField, MAX_SUGGESTIONS);
  if (fromField.length >= MAX_SUGGESTIONS) return uniqueNames(fromField, MAX_SUGGESTIONS);

  const fromBullets: string[] = [];
  for (const bullet of response.bullets) {
    const name = bullet.split(/\s[—–]\s|\s-\s/)[0]?.trim();
    if (name === undefined || name.length === 0 || name.length > 40 || name.endsWith('?')) {
      continue;
    }
    fromBullets.push(name);
  }
  return uniqueNames([...fromField, ...fromBullets], MAX_SUGGESTIONS);
}

/** Titles already offered in this thread, so a later pass can exclude them. */
export function previouslySuggestedGames(messages: ChatMessage[]): string[] {
  const names: string[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    if (message.suggestedGames !== undefined && message.suggestedGames.length > 0) {
      names.push(...message.suggestedGames);
      continue;
    }
    for (const line of message.content.split('\n')) {
      const bullet = line.replace(/^•\s*/, '');
      const name = bullet.split(/\s[—–]\s|\s-\s/)[0]?.trim();
      if (name !== undefined && name.length > 0 && name.length <= 40 && !name.endsWith('?')) {
        names.push(name);
      }
    }
  }
  return uniqueNames(names);
}

/** Drops titles that were already suggested. Omits the field when none remain. */
export function omitRepeatedSuggestions(messages: ChatMessage[], prior: string[]): ChatMessage[] {
  const blocked = new Set(
    prior.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0),
  );
  if (blocked.size === 0) return messages;

  return messages.map((message) => {
    if (message.suggestedGames === undefined) return message;
    const kept = message.suggestedGames.filter((name) => !blocked.has(name.trim().toLowerCase()));
    if (kept.length === message.suggestedGames.length) return message;
    if (kept.length === 0) {
      const rest = { ...message };
      delete rest.suggestedGames;
      return rest;
    }
    return { ...message, suggestedGames: kept };
  });
}

function uniqueNames(names: string[], limit?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name.length === 0 || name.length > 80 || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (limit !== undefined && out.length >= limit) break;
  }
  return out;
}
