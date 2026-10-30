import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ObjectSchema, Schema } from '@google/generative-ai';
import { XMLParser } from 'fast-xml-parser';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

/**
 * Shared game profile at bggGames/{bggId}.
 * Stores BoardGameGeek metadata plus a rules FAQ (question + validated answer).
 * Forum thread titles are used only as clues and are not written to Firestore.
 *
 * Requires secrets GEMINI_API_KEY and BGG_API_TOKEN:
 *   firebase functions:secrets:set BGG_API_TOKEN
 */

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const bggApiToken = defineSecret('BGG_API_TOKEN');

const BGG_BASE = 'https://boardgamegeek.com/xmlapi2';
const FAQ_COUNT = 5;
const STRATEGY_COUNT = 3;

type RulesFaqItem = { question: string; answer: string };
type GameplayQuestion = { topic: string; question: string; answer: string };
type WinningStrategy = { title: string; summary: string };

type GameProfile = {
  bggId: number;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  averageWeight?: number;
  bggRating?: number;
  bggRank?: number;
  usersRated?: number;
  thumbnailUrl?: string;
  categories: string[];
  mechanics: string[];
  rulesFaq: RulesFaqItem[];
  gameplayQuestions: GameplayQuestion[];
  winningStrategies: WinningStrategy[];
  updatedAt: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: true,
  isArray: (tagName) =>
    tagName === 'item' ||
    tagName === 'link' ||
    tagName === 'forum' ||
    tagName === 'thread' ||
    tagName === 'rank' ||
    tagName === 'name',
});

const FAQ_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING } as unknown as Schema,
          answer: { type: SchemaType.STRING } as unknown as Schema,
        },
        required: ['question', 'answer'],
      } as unknown as Schema,
    } as unknown as Schema,
  },
  required: ['items'],
};

function firestoreDb() {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function toNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toStr(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

async function fetchXml(url: string, token: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': 'BGApe/1.0 (board-game companion; server cache)',
    Accept: 'application/xml, text/xml, */*',
  };
  if (token.length > 0) headers['Authorization'] = `Bearer ${token}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    if (!res.ok) {
      throw new HttpsError('unavailable', `BoardGameGeek returned ${res.status}.`);
    }
    return res.text();
  }
  throw new HttpsError('unavailable', 'BoardGameGeek did not finish the request.');
}

function linkValues(item: Record<string, unknown>, type: string): string[] {
  const names: string[] = [];
  for (const link of asArray(item['link'])) {
    const node = asRecord(link);
    if (!node || node['type'] !== type) continue;
    const value = toStr(node['value']);
    if (value) names.push(value);
  }
  return names;
}

function valueAttr(node: unknown): number | string | undefined {
  const record = asRecord(node);
  if (!record) return undefined;
  return toNum(record['value']) ?? toStr(record['value']);
}

function parseThing(
  xml: string,
  bggId: number,
): Omit<GameProfile, 'rulesFaq' | 'gameplayQuestions' | 'winningStrategies' | 'updatedAt'> | null {
  const root = asRecord(parser.parse(xml));
  const items = asRecord(root?.['items']);
  const item = asRecord(asArray(items?.['item'])[0]);
  if (!item) return null;

  const names = asArray(item['name']);
  const primary =
    names
      .map(asRecord)
      .find((node) => node?.['type'] === 'primary') ?? asRecord(names[0]);
  const name = toStr(primary?.['value']);
  if (!name) return null;

  const stats = asRecord(item['statistics']);
  const ratings = asRecord(stats?.['ratings']);
  const ranksRoot = asRecord(ratings?.['ranks']);
  const rankNode = asArray(ranksRoot?.['rank'])
    .map(asRecord)
    .find((node) => node?.['name'] === 'boardgame');

  const year = toNum(valueAttr(item['yearpublished']));
  const minPlayers = toNum(valueAttr(item['minplayers']));
  const maxPlayers = toNum(valueAttr(item['maxplayers']));
  const playingTime = toNum(valueAttr(item['playingtime']));
  const averageWeight = toNum(ratings?.['averageweight'] ? valueAttr(ratings['averageweight']) : undefined);
  const bggRating = toNum(ratings?.['average'] ? valueAttr(ratings['average']) : undefined);
  const bggRank = toNum(rankNode?.['value']);
  const usersRated = toNum(ratings?.['usersrated'] ? valueAttr(ratings['usersrated']) : undefined);
  const thumbnailUrl = toStr(item['thumbnail']);

  const profile: Omit<GameProfile, 'rulesFaq' | 'gameplayQuestions' | 'winningStrategies' | 'updatedAt'> = {
    bggId,
    name,
    categories: linkValues(item, 'boardgamecategory').slice(0, 24),
    mechanics: linkValues(item, 'boardgamemechanic').slice(0, 24),
  };
  if (year !== undefined) profile.yearPublished = year;
  if (minPlayers !== undefined) profile.minPlayers = minPlayers;
  if (maxPlayers !== undefined) profile.maxPlayers = maxPlayers;
  if (playingTime !== undefined) profile.playingTime = playingTime;
  if (averageWeight !== undefined) profile.averageWeight = averageWeight;
  if (bggRating !== undefined) profile.bggRating = bggRating;
  if (bggRank !== undefined && bggRank > 0) profile.bggRank = bggRank;
  if (usersRated !== undefined && usersRated > 0) profile.usersRated = usersRated;
  if (thumbnailUrl !== undefined) profile.thumbnailUrl = thumbnailUrl;
  return profile;
}

function parseSearchId(xml: string, preferredName: string): number | null {
  const root = asRecord(parser.parse(xml));
  const items = asArray(asRecord(root?.['items'])?.['item']).map(asRecord);
  const want = preferredName.trim().toLowerCase();
  let fallback: number | null = null;
  for (const item of items) {
    if (!item || item['type'] !== 'boardgame') continue;
    const id = toNum(item['id']);
    if (id === undefined) continue;
    const name = toStr(asRecord(asArray(item['name'])[0])?.['value']);
    if (fallback === null) fallback = id;
    if (name !== undefined && name.toLowerCase() === want) return id;
  }
  return fallback;
}

function parseForumId(xml: string, kind: 'rules' | 'strategy'): number | null {
  const root = asRecord(parser.parse(xml));
  const forums = asArray(asRecord(root?.['forums'])?.['forum']).map(asRecord);
  const titled = forums.map((forum) => ({
    id: toNum(forum?.['id']),
    title: toStr(forum?.['title'])?.toLowerCase() ?? '',
  }));
  const match =
    kind === 'rules'
      ? titled.find((forum) => forum.title === 'rules') ??
        titled.find((forum) => forum.title.includes('rule'))
      : titled.find((forum) => forum.title === 'strategy') ??
        titled.find((forum) => forum.title.includes('strateg'));
  return match?.id ?? null;
}

function parseThreadTitles(xml: string): string[] {
  const root = asRecord(parser.parse(xml));
  const forum = asRecord(root?.['forum']);
  const threads = asArray(asRecord(forum?.['threads'])?.['thread']).map(asRecord);
  const titles: string[] = [];
  for (const thread of threads) {
    const subject = toStr(thread?.['subject']);
    if (!subject) continue;
    titles.push(subject.slice(0, 140));
    if (titles.length >= 30) break;
  }
  return titles;
}

function readStoredProfile(raw: unknown): GameProfile | null {
  const data = asRecord(raw);
  if (!data) return null;
  const bggId = toNum(data['bggId']);
  const name = toStr(data['name']);
  if (bggId === undefined || name === undefined) return null;

  const rulesFaq: RulesFaqItem[] = [];
  for (const item of asArray(data['rulesFaq'])) {
    const node = asRecord(item);
    const question = toStr(node?.['question']);
    const answer = toStr(node?.['answer']);
    if (!question || !answer) continue;
    rulesFaq.push({ question, answer });
  }

  const gameplayQuestions: GameplayQuestion[] = [];
  for (const item of asArray(data['gameplayQuestions'])) {
    const node = asRecord(item);
    const topic = toStr(node?.['topic']);
    const question = toStr(node?.['question']);
    const answer = toStr(node?.['answer']);
    if (!topic || !question || !answer) continue;
    gameplayQuestions.push({ topic, question, answer });
  }

  const winningStrategies: WinningStrategy[] = [];
  for (const item of asArray(data['winningStrategies'])) {
    const node = asRecord(item);
    const title = toStr(node?.['title']);
    const summary = toStr(node?.['summary']);
    if (!title || !summary) continue;
    winningStrategies.push({ title, summary });
  }

  const profile: GameProfile = {
    bggId,
    name,
    categories: asArray(data['categories']).map(toStr).filter((v): v is string => v !== undefined),
    mechanics: asArray(data['mechanics']).map(toStr).filter((v): v is string => v !== undefined),
    rulesFaq,
    gameplayQuestions,
    winningStrategies,
    updatedAt: toNum(data['updatedAt']) ?? 0,
  };
  const yearPublished = toNum(data['yearPublished']);
  const minPlayers = toNum(data['minPlayers']);
  const maxPlayers = toNum(data['maxPlayers']);
  const playingTime = toNum(data['playingTime']);
  const averageWeight = toNum(data['averageWeight']);
  const bggRating = toNum(data['bggRating']);
  const bggRank = toNum(data['bggRank']);
  const usersRated = toNum(data['usersRated']);
  const thumbnailUrl = toStr(data['thumbnailUrl']);
  if (yearPublished !== undefined) profile.yearPublished = yearPublished;
  if (minPlayers !== undefined) profile.minPlayers = minPlayers;
  if (maxPlayers !== undefined) profile.maxPlayers = maxPlayers;
  if (playingTime !== undefined) profile.playingTime = playingTime;
  if (averageWeight !== undefined) profile.averageWeight = averageWeight;
  if (bggRating !== undefined) profile.bggRating = bggRating;
  if (bggRank !== undefined) profile.bggRank = bggRank;
  if (usersRated !== undefined && usersRated > 0) profile.usersRated = usersRated;
  if (thumbnailUrl !== undefined) profile.thumbnailUrl = thumbnailUrl;
  return profile;
}

function profilePayload(profile: GameProfile): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    bggId: profile.bggId,
    name: profile.name,
    categories: profile.categories,
    mechanics: profile.mechanics,
    rulesFaq: profile.rulesFaq,
    gameplayQuestions: profile.gameplayQuestions,
    winningStrategies: profile.winningStrategies,
    updatedAt: profile.updatedAt,
  };
  if (profile.yearPublished !== undefined) payload['yearPublished'] = profile.yearPublished;
  if (profile.minPlayers !== undefined) payload['minPlayers'] = profile.minPlayers;
  if (profile.maxPlayers !== undefined) payload['maxPlayers'] = profile.maxPlayers;
  if (profile.playingTime !== undefined) payload['playingTime'] = profile.playingTime;
  if (profile.averageWeight !== undefined) payload['averageWeight'] = profile.averageWeight;
  if (profile.bggRating !== undefined) payload['bggRating'] = profile.bggRating;
  if (profile.bggRank !== undefined) payload['bggRank'] = profile.bggRank;
  if (profile.usersRated !== undefined) payload['usersRated'] = profile.usersRated;
  if (profile.thumbnailUrl !== undefined) payload['thumbnailUrl'] = profile.thumbnailUrl;
  return payload;
}

async function buildFaq(
  profile: Omit<GameProfile, 'rulesFaq' | 'gameplayQuestions' | 'winningStrategies' | 'updatedAt'>,
  threadTitles: string[],
  apiKey: string,
): Promise<RulesFaqItem[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: `You write a shared rules FAQ for one board game.
You may receive titles of threads from that game's BoardGameGeek rules forum. Use the titles only as clues about what players ask.
Do not quote forum posts. Return ${FAQ_COUNT} common rules questions, each with a short validated answer.
If the titles are thin or missing, use well-known rules questions for that game.
Answers must state the correct ruling plainly.`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: FAQ_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 4_096,
      ...({ thinkingConfig: { thinkingLevel: 'MINIMAL' } } as object),
    },
  });

  const lines = [
    `Game: ${profile.name}`,
    profile.categories.length > 0 ? `Categories: ${profile.categories.join(', ')}` : '',
    profile.mechanics.length > 0 ? `Mechanics: ${profile.mechanics.join(', ')}` : '',
    threadTitles.length > 0 ? `Rules-forum thread titles:\n${threadTitles.map((t) => `- ${t}`).join('\n')}` : 'No forum titles were available.',
  ].filter((line) => line.length > 0);

  const result = await model.generateContent(lines.join('\n'));
  const raw = result.response.text();
  const parsed = JSON.parse(raw) as { items?: unknown };
  const items: RulesFaqItem[] = [];
  for (const item of asArray(parsed.items)) {
    const node = asRecord(item);
    const question = toStr(node?.['question'])?.slice(0, 200);
    const answer = toStr(node?.['answer'])?.slice(0, 800);
    if (!question || !answer) continue;
    items.push({ question, answer });
    if (items.length >= FAQ_COUNT) break;
  }
  if (items.length === 0) {
    throw new HttpsError('internal', 'The rules FAQ could not be created.');
  }
  return items;
}

const STRATEGY_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING } as unknown as Schema,
          summary: { type: SchemaType.STRING } as unknown as Schema,
        },
        required: ['title', 'summary'],
      } as unknown as Schema,
    } as unknown as Schema,
  },
  required: ['items'],
};

async function buildStrategies(
  profile: Omit<GameProfile, 'rulesFaq' | 'gameplayQuestions' | 'winningStrategies' | 'updatedAt'>,
  threadTitles: string[],
  apiKey: string,
): Promise<WinningStrategy[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: `You write the top ${STRATEGY_COUNT} winning strategies for one board game.
You may receive titles of threads from that game's BoardGameGeek strategy forum. Use the titles only as clues.
Do not quote forum posts. Each strategy needs a short title and a summary of 3 to 4 sentences about how it scores or wins.
Keep the three strategies distinct.`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: STRATEGY_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 4_096,
      ...({ thinkingConfig: { thinkingLevel: 'MINIMAL' } } as object),
    },
  });

  const lines = [
    `Game: ${profile.name}`,
    profile.mechanics.length > 0 ? `Mechanics: ${profile.mechanics.join(', ')}` : '',
    threadTitles.length > 0
      ? `Strategy-forum thread titles:\n${threadTitles.map((title) => `- ${title}`).join('\n')}`
      : 'No forum titles were available.',
  ].filter((line) => line.length > 0);

  const result = await model.generateContent(lines.join('\n'));
  const raw = result.response.text();
  const parsed = JSON.parse(raw) as { items?: unknown };
  const items: WinningStrategy[] = [];
  for (const item of asArray(parsed.items)) {
    const node = asRecord(item);
    const title = toStr(node?.['title'])?.slice(0, 80);
    const summary = toStr(node?.['summary'])?.slice(0, 700);
    if (!title || !summary) continue;
    items.push({ title, summary });
    if (items.length >= STRATEGY_COUNT) break;
  }
  return items;
}

function validateInput(data: unknown): { bggId?: number; name?: string } {
  const record = asRecord(data);
  if (!record) throw new HttpsError('invalid-argument', 'Request body must be an object.');
  const result: { bggId?: number; name?: string } = {};
  if (record['bggId'] !== undefined) {
    const bggId = toNum(record['bggId']);
    if (bggId === undefined || bggId <= 0) {
      throw new HttpsError('invalid-argument', '"bggId" must be a positive number.');
    }
    result.bggId = Math.floor(bggId);
  }
  if (record['name'] !== undefined) {
    const name = toStr(record['name']);
    if (!name || name.length > 120) {
      throw new HttpsError('invalid-argument', '"name" must be a game name.');
    }
    result.name = name;
  }
  if (result.bggId === undefined && result.name === undefined) {
    throw new HttpsError('invalid-argument', 'Provide "bggId" or "name".');
  }
  return result;
}

export const ensureBggGameProfile = onCall(
  {
    region: 'europe-west10',
    enforceAppCheck: true,
    secrets: [geminiApiKey, bggApiToken],
    timeoutSeconds: 90,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const input = validateInput(request.data);
    const db = firestoreDb();
    const token = bggApiToken.value();

    let bggId = input.bggId;
    if (bggId === undefined && input.name) {
      const searchXml = await fetchXml(
        `${BGG_BASE}/search?query=${encodeURIComponent(input.name)}&type=boardgame`,
        token,
      );
      const found = parseSearchId(searchXml, input.name);
      if (found === null) {
        throw new HttpsError('not-found', `No BoardGameGeek match for "${input.name}".`);
      }
      bggId = found;
    }
    if (bggId === undefined) {
      throw new HttpsError('invalid-argument', 'Provide "bggId" or "name".');
    }

    const ref = db.collection('bggGames').doc(String(bggId));
    const existingSnap = await ref.get();
    const existing = existingSnap.exists ? readStoredProfile(existingSnap.data()) : null;
    const needsFaq = existing === null || existing.rulesFaq.length === 0;
    const needsStrategies = existing === null || existing.winningStrategies.length === 0;
    if (existing && !needsFaq && !needsStrategies) {
      return profilePayload(existing);
    }

    const thingXml = await fetchXml(`${BGG_BASE}/thing?id=${bggId}&stats=1`, token);
    const thing = parseThing(thingXml, bggId);
    if (!thing) {
      throw new HttpsError('not-found', 'BoardGameGeek did not return this game.');
    }

    let rulesTitles: string[] = [];
    let strategyTitles: string[] = [];
    try {
      const forumListXml = await fetchXml(`${BGG_BASE}/forumlist?id=${bggId}&type=thing`, token);
      const rulesForumId = needsFaq ? parseForumId(forumListXml, 'rules') : null;
      const strategyForumId = needsStrategies ? parseForumId(forumListXml, 'strategy') : null;
      if (rulesForumId !== null) {
        rulesTitles = parseThreadTitles(await fetchXml(`${BGG_BASE}/forum?id=${rulesForumId}`, token));
      }
      if (strategyForumId !== null) {
        strategyTitles = parseThreadTitles(
          await fetchXml(`${BGG_BASE}/forum?id=${strategyForumId}`, token),
        );
      }
    } catch (error) {
      console.warn('[ensureBggGameProfile] Forum lookup skipped:', error);
    }

    const apiKey = geminiApiKey.value();
    const rulesFaq =
      needsFaq || existing === null ? await buildFaq(thing, rulesTitles, apiKey) : existing.rulesFaq;
    let winningStrategies = existing?.winningStrategies ?? [];
    if (needsStrategies) {
      try {
        winningStrategies = await buildStrategies(thing, strategyTitles, apiKey);
      } catch (error) {
        console.warn('[ensureBggGameProfile] Strategy notes skipped:', error);
      }
    }
    const profile: GameProfile = {
      ...thing,
      rulesFaq,
      gameplayQuestions: existing?.gameplayQuestions ?? [],
      winningStrategies,
      updatedAt: Date.now(),
    };
    await ref.set(profilePayload(profile));
    return profilePayload(profile);
  },
);

const GAMEPLAY_CAP = 40;

function clipText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/**
 * Appends one solved rules question to the shared game profile.
 * The same question text replaces an older entry instead of stacking duplicates.
 */
export const recordGameplayQuestion = onCall(
  {
    region: 'europe-west10',
    enforceAppCheck: true,
    secrets: [bggApiToken],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }
    const record = asRecord(request.data);
    if (!record) throw new HttpsError('invalid-argument', 'Request body must be an object.');

    const topic = toStr(record['topic']);
    const question = toStr(record['question']);
    const answer = toStr(record['answer']);
    const name = toStr(record['name']);
    if (!topic) throw new HttpsError('invalid-argument', '"topic" is required.');
    if (!question) throw new HttpsError('invalid-argument', '"question" is required.');
    if (!answer) throw new HttpsError('invalid-argument', '"answer" is required.');
    if (!name || name.length > 120) {
      throw new HttpsError('invalid-argument', '"name" must be a game name.');
    }

    let bggId = toNum(record['bggId']);
    if (record['bggId'] !== undefined && (bggId === undefined || bggId <= 0)) {
      throw new HttpsError('invalid-argument', '"bggId" must be a positive number.');
    }
    if (bggId !== undefined) bggId = Math.floor(bggId);

    if (bggId === undefined) {
      const searchXml = await fetchXml(
        `${BGG_BASE}/search?query=${encodeURIComponent(name)}&type=boardgame`,
        bggApiToken.value(),
      );
      const found = parseSearchId(searchXml, name);
      if (found === null) {
        throw new HttpsError('not-found', `No BoardGameGeek match for "${name}".`);
      }
      bggId = found;
    }

    const item: GameplayQuestion = {
      topic: clipText(topic, 80),
      question: clipText(question, 2000),
      answer: clipText(answer, 4000),
    };

    const ref = firestoreDb().collection('bggGames').doc(String(bggId));
    const snap = await ref.get();
    const existing = snap.exists ? readStoredProfile(snap.data()) : null;
    const prior = existing?.gameplayQuestions ?? [];
    const key = item.question.toLowerCase();
    const gameplayQuestions = [
      ...prior.filter((entry) => entry.question.toLowerCase() !== key),
      item,
    ].slice(-GAMEPLAY_CAP);
    const updatedAt = Date.now();

    if (existing) {
      await ref.set(profilePayload({ ...existing, gameplayQuestions, updatedAt }));
    } else if (snap.exists) {
      await ref.set({ gameplayQuestions, updatedAt }, { merge: true });
    } else {
      await ref.set({
        bggId,
        name,
        categories: [],
        mechanics: [],
        rulesFaq: [],
        gameplayQuestions,
        winningStrategies: [],
        updatedAt,
      });
    }

    return { saved: true as const, bggId };
  },
);
