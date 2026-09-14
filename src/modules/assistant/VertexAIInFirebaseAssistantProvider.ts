import { callable } from '@/backend/functions';
import type { AssistantProvider } from '@/features/assistant/services/AssistantProvider';
import type {
  AssistantChunk,
  AssistantRequest,
  AssistantResponse,
} from '@/features/assistant/types';
import { logger } from '@/services/logger';

const STREAM_CHUNK_SIZE = 6;
const STREAM_INTERVAL_MS = 30;

function buildStreamText(response: AssistantResponse): string {
  const bulletLines = response.bullets.map((b) => `• ${b}`).join('\n');
  return `${response.title}\n\n${response.summary}\n\n${bulletLines}`;
}

function cacheKey(request: AssistantRequest): string {
  return JSON.stringify({
    text: request.text,
    threadReason: request.threadReason,
    isFirstMessage: request.isFirstMessage,
    activityBias: request.activityBias ?? 'none',
    collection: request.collectionContext?.map((g) => g.name) ?? [],
    history: request.recentMessages?.map((m) => `${m.role}:${m.content.slice(0, 40)}`) ?? [],
  });
}

/**
 * Calls the `assistantCall` Cloud Function (Gemini 2.0 Flash, europe-west10).
 *
 * Stream + complete share a single in-flight Promise so the orchestrator's
 * stream() → complete() sequence only makes one network round-trip.
 */
export class VertexAIInFirebaseAssistantProvider implements AssistantProvider {
  private _inFlight: Promise<AssistantResponse> | null = null;
  private _lastKey: string | null = null;
  private _lastResponse: AssistantResponse | null = null;

  private _callable = callable<AssistantRequest, AssistantResponse>('assistantCall');

  private _getCached(request: AssistantRequest): AssistantResponse | null {
    const key = cacheKey(request);
    return this._lastKey === key && this._lastResponse ? this._lastResponse : null;
  }

  private async _ensureResponse(request: AssistantRequest): Promise<AssistantResponse> {
    const cached = this._getCached(request);
    if (cached) return cached;

    if (!this._inFlight) {
      this._inFlight = this._callable(request)
        .then((result) => {
          this._lastKey = cacheKey(request);
          this._lastResponse = result;
          return result;
        })
        .catch((err) => {
          logger.captureException(err, { context: 'VertexAIInFirebaseAssistantProvider' });
          throw err;
        })
        .finally(() => {
          this._inFlight = null;
        });
    }

    return this._inFlight;
  }

  complete(request: AssistantRequest): Promise<AssistantResponse> {
    return this._ensureResponse(request);
  }

  async *stream(request: AssistantRequest): AsyncIterable<AssistantChunk> {
    const response = await this._ensureResponse(request);
    const fullText = buildStreamText(response);

    for (let i = 0; i < fullText.length; i += STREAM_CHUNK_SIZE) {
      const delta = fullText.slice(i, i + STREAM_CHUNK_SIZE);
      const done = i + STREAM_CHUNK_SIZE >= fullText.length;

      await new Promise<void>((resolve) => setTimeout(resolve, STREAM_INTERVAL_MS));

      yield { delta, done };

      if (done) return;
    }

    yield { delta: '', done: true };
  }
}

export const vertexAIAssistantProvider = new VertexAIInFirebaseAssistantProvider();
