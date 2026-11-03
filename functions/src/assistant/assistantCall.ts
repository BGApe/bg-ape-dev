import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ObjectSchema, Schema } from '@google/generative-ai';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  buildSystemPrompt,
  formatCollectionContextForModel,
  formatConversationHistoryForModel,
  formatGameContextForModel,
} from './prompts';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

type ChatIntent = 'recommendation' | 'quick_guide' | 'generic';
type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';
type ActivityBias = 'none' | 'undereplayed' | 'favorites' | 'recent';
type SetupDepth = 'quick' | 'basic' | 'full';

type CollectionGameContextItem = {
  name: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  averageWeight?: number;
  categories?: string[];
  mechanics?: string[];
  playCount?: number;
  daysSinceLastPlay?: number;
};

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantCallRequest = {
  text: string;
  intent: ChatIntent;
  threadReason: ChatReason;
  isFirstMessage: boolean;
  collectionContext?: CollectionGameContextItem[];
  activityBias?: ActivityBias;
  gameContext?: CollectionGameContextItem;
  setupDepth?: SetupDepth;
  recentMessages?: HistoryMessage[];
};

/**
 * JSON schema enforced by Gemini — guarantees a parseable structured response.
 * Annotated as ObjectSchema so contextual typing prevents SchemaType enum
 * widening on the `type` discriminant. Nested property objects are asserted
 * as Schema via double-cast because their `type` fields also suffer widening.
 */
const RESPONSE_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    type: { type: SchemaType.STRING, enum: ['recommendation', 'quick_guide', 'generic'] } as unknown as Schema,
    title: { type: SchemaType.STRING } as unknown as Schema,
    summary: { type: SchemaType.STRING } as unknown as Schema,
    bullets: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING } as unknown as Schema,
    } as unknown as Schema,
    suggestedGames: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING } as unknown as Schema,
    } as unknown as Schema,
  },
  required: ['type', 'title', 'summary', 'bullets', 'suggestedGames'],
};

const VALID_INTENTS: ChatIntent[] = ['recommendation', 'quick_guide', 'generic'];
const VALID_REASONS: ChatReason[] = ['recommendation', 'setup', 'rules', 'general'];
const VALID_BIAS: ActivityBias[] = ['none', 'undereplayed', 'favorites', 'recent'];
const VALID_SETUP_DEPTH: SetupDepth[] = ['quick', 'basic', 'full'];
const VALID_HISTORY_ROLES = ['user', 'assistant'] as const;

function parseCollectionItem(raw: unknown): CollectionGameContextItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o['name'] !== 'string' || o['name'].trim().length === 0) return null;

  const item: CollectionGameContextItem = { name: o['name'].trim().slice(0, 120) };

  if (typeof o['minPlayers'] === 'number') item.minPlayers = o['minPlayers'];
  if (typeof o['maxPlayers'] === 'number') item.maxPlayers = o['maxPlayers'];
  if (typeof o['playingTime'] === 'number') item.playingTime = o['playingTime'];
  if (typeof o['averageWeight'] === 'number') item.averageWeight = o['averageWeight'];
  if (typeof o['playCount'] === 'number') item.playCount = o['playCount'];
  if (typeof o['daysSinceLastPlay'] === 'number') item.daysSinceLastPlay = o['daysSinceLastPlay'];
  if (Array.isArray(o['categories'])) {
    item.categories = o['categories'].filter((x): x is string => typeof x === 'string').slice(0, 8);
  }
  if (Array.isArray(o['mechanics'])) {
    item.mechanics = o['mechanics'].filter((x): x is string => typeof x === 'string').slice(0, 8);
  }
  return item;
}

function parseHistoryMessage(raw: unknown): HistoryMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!VALID_HISTORY_ROLES.includes(o['role'] as (typeof VALID_HISTORY_ROLES)[number])) {
    return null;
  }
  if (typeof o['content'] !== 'string' || o['content'].trim().length === 0) return null;
  return {
    role: o['role'] as 'user' | 'assistant',
    content: o['content'].trim().slice(0, 1_000),
  };
}

function validateRequest(data: unknown): AssistantCallRequest {
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request body must be an object.');
  }

  const d = data as Record<string, unknown>;

  if (typeof d['text'] !== 'string' || d['text'].trim().length === 0) {
    throw new HttpsError('invalid-argument', '"text" must be a non-empty string.');
  }
  if (d['text'].length > 2_000) {
    throw new HttpsError('invalid-argument', '"text" exceeds maximum length of 2000 characters.');
  }
  if (!VALID_INTENTS.includes(d['intent'] as ChatIntent)) {
    throw new HttpsError('invalid-argument', `"intent" must be one of: ${VALID_INTENTS.join(', ')}.`);
  }
  if (!VALID_REASONS.includes(d['threadReason'] as ChatReason)) {
    throw new HttpsError('invalid-argument', `"threadReason" must be one of: ${VALID_REASONS.join(', ')}.`);
  }
  if (typeof d['isFirstMessage'] !== 'boolean') {
    throw new HttpsError('invalid-argument', '"isFirstMessage" must be a boolean.');
  }

  const result: AssistantCallRequest = {
    text: d['text'] as string,
    intent: d['intent'] as ChatIntent,
    threadReason: d['threadReason'] as ChatReason,
    isFirstMessage: d['isFirstMessage'] as boolean,
  };

  if (d['collectionContext'] !== undefined) {
    if (!Array.isArray(d['collectionContext'])) {
      throw new HttpsError('invalid-argument', '"collectionContext" must be an array.');
    }
    if (d['collectionContext'].length > 80) {
      throw new HttpsError('invalid-argument', '"collectionContext" exceeds maximum of 80 games.');
    }
    const parsed = d['collectionContext']
      .map(parseCollectionItem)
      .filter((x): x is CollectionGameContextItem => x !== null);
    if (parsed.length > 0) result.collectionContext = parsed;
  }

  if (d['activityBias'] !== undefined) {
    if (!VALID_BIAS.includes(d['activityBias'] as ActivityBias)) {
      throw new HttpsError('invalid-argument', `"activityBias" must be one of: ${VALID_BIAS.join(', ')}.`);
    }
    result.activityBias = d['activityBias'] as ActivityBias;
  }

  if (d['gameContext'] !== undefined) {
    const parsed = parseCollectionItem(d['gameContext']);
    if (parsed === null) {
      throw new HttpsError('invalid-argument', '"gameContext" must be a valid game object with a name.');
    }
    result.gameContext = parsed;
  }

  if (d['setupDepth'] !== undefined) {
    if (!VALID_SETUP_DEPTH.includes(d['setupDepth'] as SetupDepth)) {
      throw new HttpsError(
        'invalid-argument',
        `"setupDepth" must be one of: ${VALID_SETUP_DEPTH.join(', ')}.`,
      );
    }
    result.setupDepth = d['setupDepth'] as SetupDepth;
  }

  if (d['recentMessages'] !== undefined) {
    if (!Array.isArray(d['recentMessages'])) {
      throw new HttpsError('invalid-argument', '"recentMessages" must be an array.');
    }
    if (d['recentMessages'].length > 20) {
      throw new HttpsError('invalid-argument', '"recentMessages" exceeds maximum of 20 messages.');
    }
    const parsed = d['recentMessages']
      .map(parseHistoryMessage)
      .filter((x): x is HistoryMessage => x !== null);
    if (parsed.length > 0) result.recentMessages = parsed;
  }

  return result;
}

function buildUserContent(payload: AssistantCallRequest): string {
  const parts: string[] = [];

  const historyBlock = formatConversationHistoryForModel(payload.recentMessages ?? []);
  if (historyBlock) parts.push(historyBlock);

  parts.push(`Current message:\n${payload.text}`);

  if (payload.gameContext) {
    parts.push(formatGameContextForModel(payload.gameContext));
  }

  const collectionBlock = formatCollectionContextForModel(
    payload.collectionContext ?? [],
    payload.activityBias ?? 'none',
  );
  if (collectionBlock) parts.push(collectionBlock);

  return parts.join('\n\n---\n');
}

export const assistantCall = onCall(
  {
    region: 'europe-west10',
    enforceAppCheck: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const payload = validateRequest(request.data);
    const userContent = buildUserContent(payload);

    // Soft guard: history (optimal ~6 msgs) + collection/game context + current text.
    if (userContent.length > 10_000) {
      throw new HttpsError(
        'invalid-argument',
        'Combined message, history, and collection context is too large.',
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: buildSystemPrompt(payload.threadReason, payload.isFirstMessage, {
        setupDepth: payload.setupDepth,
        hasGameContext: payload.gameContext !== undefined,
      }),
      // Gemini 3.x thinking tokens count against maxOutputTokens. Default
      // thinking with 1024 max cut JSON mid-string (MAX_TOKENS). Keep thinking
      // minimal for structured replies and leave room for the payload.
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.7,
        maxOutputTokens: 4_096,
        // SDK types lag behind Gemini 3 thinkingConfig; cast keeps the call site typed.
        ...({ thinkingConfig: { thinkingLevel: 'MINIMAL' } } as object),
      },
    });

    let raw: string;
    let finishReason: string | undefined;
    try {
      const result = await model.generateContent(userContent);
      const candidate = result.response.candidates?.[0];
      finishReason = candidate?.finishReason;
      const parts = candidate?.content?.parts ?? [];
      raw = parts
        .filter((p) => !('thought' in p && (p as { thought?: boolean }).thought === true))
        .map((p) => ('text' in p && typeof p.text === 'string' ? p.text : ''))
        .join('');
      if (!raw) raw = result.response.text();
    } catch (err) {
      console.error('[assistantCall] Gemini API error:', err);
      throw new HttpsError('internal', 'The assistant is temporarily unavailable. Please try again.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[assistantCall] Failed to parse Gemini JSON response:', {
        finishReason,
        preview: raw.slice(0, 400),
        length: raw.length,
      });
      throw new HttpsError('internal', 'Received an unexpected response from the assistant.');
    }

    return sanitizeAssistantPayload(parsed);
  },
);

/** Keeps suggested game titles short and capped so reply buttons stay usable. */
function sanitizeAssistantPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const record = parsed as Record<string, unknown>;
  const rawGames = Array.isArray(record['suggestedGames']) ? record['suggestedGames'] : [];
  const suggestedGames = rawGames
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= 80)
    .slice(0, 5);
  return { ...record, suggestedGames };
}
