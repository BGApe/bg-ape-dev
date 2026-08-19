import { XMLParser } from 'fast-xml-parser';

import { logger } from '@/services/logger';

import type { BggSearchResult, BggThing } from './types';

const BASE = 'https://boardgamegeek.com/xmlapi2';

// ─── Rate-limiting ────────────────────────────────────────────────────────────
//
// BGG / Cloudflare tolerance: ~1 request every 5 s for bulk access.
// For interactive (user-triggered) calls a 1.5 s floor is safe in practice and
// keeps the UI responsive. All requests share one serial queue so concurrent
// calls never overlap regardless of how many components are mounted.
//
const MIN_GAP_MS = 1_500;

let _queue: Promise<void> = Promise.resolve();

/**
 * Serialises all BGG HTTP calls through a single promise chain and enforces
 * a minimum gap between the END of one response and the START of the next.
 */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = _queue.then(fn);
  // Whether fn resolves or rejects, hold the queue for MIN_GAP_MS before
  // releasing the next waiter.
  _queue = result.then(
    () => delay(MIN_GAP_MS),
    () => delay(MIN_GAP_MS),
  );
  return result;
}

// ─── Retry helpers ────────────────────────────────────────────────────────────

const MAX_RETRIES = 4;
/** Base delay for exponential backoff (doubles each attempt). */
const BASE_BACKOFF_MS = 2_000;
/** Extra random jitter cap to avoid thundering-herd on simultaneous retries. */
const JITTER_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, overrideMs?: number): Promise<void> {
  const base = overrideMs ?? BASE_BACKOFF_MS * 2 ** attempt;
  const jitter = Math.random() * JITTER_MS;
  return delay(base + jitter);
}

/**
 * Reads the Retry-After response header (seconds or HTTP-date) and returns the
 * wait time in milliseconds, or undefined if the header is absent/unparseable.
 */
function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get('Retry-After');
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return secs * 1_000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

// ─── XML parsing ─────────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: true,
  isArray: (name) => name === 'item' || name === 'rank' || name === 'name' || name === 'link',
});

type XmlNode = Record<string, unknown>;

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

/**
 * Extracts all <link> values of a given type from a BGG /thing item node.
 * Returns an empty array when none are present.
 */
function extractLinks(item: XmlNode, type: string): string[] {
  const links = item.link;
  if (!Array.isArray(links)) return [];
  return (links as XmlNode[])
    .filter((l) => l.type === type)
    .map((l) => toStr(l.value))
    .filter((v): v is string => v !== undefined);
}

// ─── Core fetch ──────────────────────────────────────────────────────────────

/**
 * Fetches XML from BGG through the shared rate-limit queue.
 *
 * - 200 → return body text
 * - 202 → BGG is building the response; retry with short backoff (collection
 *         endpoint only, but we handle it everywhere for robustness)
 * - 429 / 503 → rate-limited or busy; exponential backoff honouring Retry-After
 * - anything else → log and return null
 */
async function fetchXml(url: string): Promise<string | null> {
  return enqueue(async () => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        res = await fetch(url);
      } catch (err) {
        logger.warn('[BGG] Network error', { url, attempt, err });
        await backoffDelay(attempt);
        continue;
      }

      if (res.status === 200) return res.text();

      if (res.status === 202) {
        // Response queued — BGG asks us to poll; 2 s is the safe minimum.
        logger.info('[BGG] 202 queued, will retry', { url, attempt });
        await backoffDelay(attempt, 2_000);
        continue;
      }

      if (res.status === 429 || res.status === 503) {
        const wait = retryAfterMs(res) ?? BASE_BACKOFF_MS * 2 ** (attempt + 1);
        logger.warn('[BGG] Rate limited', { url, status: res.status, waitMs: wait, attempt });
        await delay(wait + Math.random() * JITTER_MS);
        continue;
      }

      logger.warn('[BGG] Unexpected status', { url, status: res.status });
      return null;
    }

    logger.warn('[BGG] Gave up after retries', { url });
    return null;
  });
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseThingItem(item: XmlNode, bggId: number): BggThing | null {
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

  const categories = extractLinks(item, 'boardgamecategory');
  if (categories.length > 0) thing.categories = categories;

  const mechanics = extractLinks(item, 'boardgamemechanic');
  if (mechanics.length > 0) thing.mechanics = mechanics;

  return thing;
}

// ─── Public client ───────────────────────────────────────────────────────────

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

  /**
   * Fetches full details for a single BGG game.
   * The result is cached by React Query for 1 hour so repeated calls for the
   * same game never hit the network.
   */
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

    return parseThingItem(item, bggId);
  },

  /**
   * Fetches full details for up to 20 BGG games in a single API call.
   * IDs beyond the first 20 are silently dropped (BGG hard limit).
   * Use this when enriching multiple existing collection entries at once.
   */
  async getThings(bggIds: number[]): Promise<BggThing[]> {
    if (bggIds.length === 0) return [];
    const batch = bggIds.slice(0, 20);
    const xml = await fetchXml(`${BASE}/thing?id=${batch.join(',')}&stats=1`);
    if (xml === null) return [];

    let parsed: XmlNode;
    try {
      parsed = parser.parse(xml) as XmlNode;
    } catch (error) {
      logger.warn('[BGG] Failed to parse things XML', { error });
      return [];
    }

    const items = (parsed.items as XmlNode | undefined)?.item;
    if (!Array.isArray(items)) return [];

    const results: BggThing[] = [];
    for (let i = 0; i < (items as XmlNode[]).length; i++) {
      const item = (items as XmlNode[])[i];
      const id = batch[i];
      if (item === undefined || id === undefined) continue;
      const thing = parseThingItem(item, id);
      if (thing !== null) results.push(thing);
    }
    return results;
  },
};
