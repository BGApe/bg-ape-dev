import { XMLParser } from 'fast-xml-parser';

import type { BggSearchResult, BggThing } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: true,
  // Force arrays only for repeating elements. Do NOT include "name" — the
  // <rank name="boardgame"> attribute shares that tag name and would become
  // ["boardgame"], breaking rank lookups. primaryName() already handles both
  // a single <name> node and an array of them.
  isArray: (tagName) => tagName === 'item' || tagName === 'rank' || tagName === 'link',
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

function isTruthyAttr(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Expansion links on a base game (outbound) or parent link on an expansion (inbound).
 */
function extractExpansionLinks(item: XmlNode): {
  expansions: { bggId: number; name: string }[];
  parentBggId: number | undefined;
} {
  const links = item.link;
  if (!Array.isArray(links)) return { expansions: [], parentBggId: undefined };

  const expansions: { bggId: number; name: string }[] = [];
  let parentBggId: number | undefined;

  for (const l of links as XmlNode[]) {
    if (l.type !== 'boardgameexpansion') continue;
    const id = toNum(l.id);
    const name = toStr(l.value);
    if (id === undefined || name === undefined) continue;

    if (isTruthyAttr(l.inbound)) {
      // Expansion → parent base game
      if (parentBggId === undefined) parentBggId = id;
    } else {
      expansions.push({ bggId: id, name });
    }
  }

  return { expansions, parentBggId };
}

/** Parses a single BGG /thing <item> node into a domain object. */
export function parseThingItem(item: XmlNode, bggId: number): BggThing | null {
  const name = primaryName(item.name);
  if (name === undefined) return null;

  const rawType = toStr(item.type);
  const kind: BggThing['kind'] =
    rawType === 'boardgameexpansion'
      ? 'boardgameexpansion'
      : rawType === 'boardgame'
        ? 'boardgame'
        : 'other';

  const thing: BggThing = { bggId, name, kind };

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

  const { expansions, parentBggId } = extractExpansionLinks(item);
  if (kind === 'boardgameexpansion' && parentBggId !== undefined) {
    thing.parentBggId = parentBggId;
  }
  if (expansions.length > 0) {
    thing.expansions = expansions;
    thing.expansionCount = expansions.length;
  }

  return thing;
}

/** Parses a BGG /thing XML response body into zero or more domain objects. */
export function parseThingXml(xml: string): BggThing[] {
  const parsed = parser.parse(xml) as XmlNode;
  const items = (parsed.items as XmlNode | undefined)?.item;
  if (!Array.isArray(items)) return [];

  const results: BggThing[] = [];
  for (const item of items as XmlNode[]) {
    const id = toNum(item.id);
    if (id === undefined) continue;
    const thing = parseThingItem(item, id);
    if (thing !== null) results.push(thing);
  }
  return results;
}

/** Parses a BGG /search XML response body into search hits. */
export function parseSearchXml(xml: string): BggSearchResult[] {
  const parsed = parser.parse(xml) as XmlNode;
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
}
