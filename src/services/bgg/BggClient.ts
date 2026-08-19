import { XMLParser } from 'fast-xml-parser';

import { logger } from '@/services/logger';

import type { BggSearchResult, BggThing } from './types';

const BASE = 'https://boardgamegeek.com/xmlapi2';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 900;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: true,
  isArray: (name) => name === 'item' || name === 'rank' || name === 'name',
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches XML from BGG. The API answers 202 while it builds a response and
 * 429 when rate-limited; both are retried with a short backoff.
 */
async function fetchXml(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    if (res.status === 200) return res.text();
    if (res.status === 202 || res.status === 429) {
      await delay(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }
    logger.warn('[BGG] Unexpected status', { url, status: res.status });
    return null;
  }
  logger.warn('[BGG] Gave up after retries', { url });
  return null;
}

function toNum(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toStr(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

type XmlNode = Record<string, unknown>;

/** Picks the primary <name> value from a (possibly array) name node. */
function primaryName(nameNode: unknown): string | undefined {
  if (Array.isArray(nameNode)) {
    const primary = nameNode.find((n) => (n as XmlNode).type === 'primary') ?? nameNode[0];
    return toStr((primary as XmlNode | undefined)?.value);
  }
  if (nameNode !== null && typeof nameNode === 'object') {
    return toStr((nameNode as XmlNode).value);
  }
  return undefined;
}

export const bggClient = {
  async search(query: string): Promise<BggSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const xml = await fetchXml(
      `${BASE}/search?type=boardgame&query=${encodeURIComponent(trimmed)}`,
    );
    if (xml === null) return [];

    let parsed: XmlNode;
    try {
      parsed = parser.parse(xml) as XmlNode;
    } catch (error) {
      logger.warn('[BGG] Failed to parse search XML', { error });
      return [];
    }

    const items = (parsed.items as XmlNode | undefined)?.item;
    if (!Array.isArray(items)) return [];

    const results: BggSearchResult[] = [];
    const seen = new Set<number>();
    for (const item of items as XmlNode[]) {
      const bggId = toNum(item.id);
      const name = primaryName(item.name);
      if (bggId === undefined || name === undefined || seen.has(bggId)) continue;
      seen.add(bggId);

      const result: BggSearchResult = { bggId, name };
      const year = toNum((item.yearpublished as XmlNode | undefined)?.value);
      if (year !== undefined && year > 0) result.yearPublished = year;
      results.push(result);
    }
    return results;
  },

  async getThing(bggId: number): Promise<BggThing | null> {
    const xml = await fetchXml(`${BASE}/thing?id=${bggId}&stats=1`);
    if (xml === null) return null;

    let parsed: XmlNode;
    try {
      parsed = parser.parse(xml) as XmlNode;
    } catch (error) {
      logger.warn('[BGG] Failed to parse thing XML', { error });
      return null;
    }

    const items = (parsed.items as XmlNode | undefined)?.item;
    const item = (Array.isArray(items) ? items[0] : items) as XmlNode | undefined;
    if (item === undefined) return null;

    const name = primaryName(item.name);
    if (name === undefined) return null;

    const thing: BggThing = { bggId, name };

    const year = toNum((item.yearpublished as XmlNode | undefined)?.value);
    if (year !== undefined && year > 0) thing.yearPublished = year;

    const minP = toNum((item.minplayers as XmlNode | undefined)?.value);
    if (minP !== undefined && minP > 0) thing.minPlayers = minP;

    const maxP = toNum((item.maxplayers as XmlNode | undefined)?.value);
    if (maxP !== undefined && maxP > 0) thing.maxPlayers = maxP;

    const time = toNum((item.playingtime as XmlNode | undefined)?.value);
    if (time !== undefined && time > 0) thing.playingTime = time;

    const thumb = toStr(item.thumbnail);
    if (thumb !== undefined) thing.thumbnailUrl = thumb;

    const image = toStr(item.image);
    if (image !== undefined) thing.imageUrl = image;

    const description = toStr(item.description);
    if (description !== undefined) thing.description = description;

    const ratings = ((item.statistics as XmlNode | undefined)?.ratings ?? undefined) as
      | XmlNode
      | undefined;
    if (ratings !== undefined) {
      const rating = toNum((ratings.average as XmlNode | undefined)?.value);
      if (rating !== undefined && rating > 0) thing.bggRating = rating;

      const weight = toNum((ratings.averageweight as XmlNode | undefined)?.value);
      if (weight !== undefined && weight > 0) thing.averageWeight = weight;

      const ranks = (ratings.ranks as XmlNode | undefined)?.rank;
      if (Array.isArray(ranks)) {
        const overall = (ranks as XmlNode[]).find(
          (r) => r.type === 'subtype' && r.name === 'boardgame',
        );
        const rank = toNum(overall?.value);
        if (rank !== undefined && rank > 0) thing.bggRank = rank;
      }
    }

    return thing;
  },
};
