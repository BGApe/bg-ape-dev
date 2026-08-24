import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ObjectSchema, Schema } from '@google/generative-ai';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { buildSystemPrompt } from './prompts';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

type ChatIntent = 'recommendation' | 'quick_guide' | 'generic';
type ChatReason = 'recommendation' | 'setup' | 'rules' | 'general';

type AssistantCallRequest = {
  text: string;
  intent: ChatIntent;
  threadReason: ChatReason;
  isFirstMessage: boolean;
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
  },
  required: ['type', 'title', 'summary', 'bullets'],
};

const VALID_INTENTS: ChatIntent[] = ['recommendation', 'quick_guide', 'generic'];
const VALID_REASONS: ChatReason[] = ['recommendation', 'setup', 'rules', 'general'];

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

  return {
    text: d['text'] as string,
    intent: d['intent'] as ChatIntent,
    threadReason: d['threadReason'] as ChatReason,
    isFirstMessage: d['isFirstMessage'] as boolean,
  };
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

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: buildSystemPrompt(payload.threadReason, payload.isFirstMessage),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.7,
        maxOutputTokens: 1_024,
      },
    });

    let raw: string;
    try {
      const result = await model.generateContent(payload.text);
      raw = result.response.text();
    } catch (err) {
      console.error('[assistantCall] Gemini API error:', err);
      throw new HttpsError('internal', 'The assistant is temporarily unavailable. Please try again.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[assistantCall] Failed to parse Gemini JSON response:', raw);
      throw new HttpsError('internal', 'Received an unexpected response from the assistant.');
    }

    return parsed;
  },
);
