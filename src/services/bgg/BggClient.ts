import { env } from '@/config/env';
import { logger } from '@/services/logger';

import { parseSearchXml, parseThingXml } from './bggParsers';
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

// ─── Core fetch ──────────────────────────────────────────────────────────────

/**
 * BGG / Cloudflare requires a descriptive User-Agent so requests are not
 * treated as anonymous bots. BGG's own Terms of Use ask you to identify
 * your application here.
 *
 * The Authorization header is included when EXPO_PUBLIC_BGG_TOKEN is set.
 * The public XML API2 works without it; the token raises rate limits.
 */
function buildBggHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'BGApe/1.0 (board-game companion app; https://bgape.dev)',
    Accept: 'application/xml, text/xml, */*',
  };
  if (env.EXPO_PUBLIC_BGG_TOKEN) {
    headers['Authorization'] = `Bearer ${env.EXPO_PUBLIC_BGG_TOKEN}`;
  }
  return headers;
}

/**
 * Fetches XML from BGG through the shared rate-limit queue.
 *
 * - 200 → return body text
 * - 202 → BGG is building the response; retry with short backoff (collection
 *         endpoint only, but we handle it everywhere for robustness)
 * - 401 / 403 → auth / Cloudflare challenge — log and return null
 * - 429 / 503 → rate-limited or busy; exponential backoff honouring Retry-After
 * - anything else → log and return null
 */
async function fetchXml(url: string): Promise<string | null> {
  return enqueue(async () => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { headers: buildBggHeaders() });
      } catch (err) {
        logger.warn('[BGG] Network error', { url, attempt, err });
        await backoffDelay(attempt);
        continue;
      }

      if (res.status === 200) return res.text();

      if (res.status === 401 || res.status === 403) {
        logger.warn('[BGG] Auth/Cloudflare block — check User-Agent or API key', {
          url,
          status: res.status,
        });
        return null; // no point retrying an auth failure
      }

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

// ─── Public client ───────────────────────────────────────────────────────────

export const bggClient = {
  async search(query: string): Promise<BggSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const xml = await fetchXml(
      `${BASE}/search?type=boardgame&query=${encodeURIComponent(trimmed)}`,
    );
    if (xml === null) return [];

    try {
      return parseSearchXml(xml);
    } catch (error) {
      logger.warn('[BGG] Failed to parse search XML', { error });
      return [];
    }
  },

  /**
   * Fetches full details for a single BGG game.
   * The result is cached by React Query for 1 hour so repeated calls for the
   * same game never hit the network.
   */
  async getThing(bggId: number): Promise<BggThing | null> {
    const xml = await fetchXml(`${BASE}/thing?id=${bggId}&stats=1`);
    if (xml === null) return null;

    try {
      return parseThingXml(xml)[0] ?? null;
    } catch (error) {
      logger.warn('[BGG] Failed to parse thing XML', { error });
      return null;
    }
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

    try {
      return parseThingXml(xml);
    } catch (error) {
      logger.warn('[BGG] Failed to parse things XML', { error });
      return [];
    }
  },
};
