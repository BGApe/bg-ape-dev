import type { AssistantProvider } from '@/features/assistant/services/AssistantProvider';
import type {
  AssistantChunk,
  AssistantRequest,
  AssistantResponse,
} from '@/features/assistant/types';

/**
 * TODO Phase 5: Invoke the `assistantCall` Cloud Function (Gemini via Vertex AI in Firebase).
 * Requires: @react-native-firebase/functions callable, App Check enforcement.
 * Gated behind featureFlags.assistant.useRealProvider.
 */
export class VertexAIInFirebaseAssistantProvider implements AssistantProvider {
  complete(_request: AssistantRequest): Promise<AssistantResponse> {
    return Promise.reject(
      new Error('VertexAIInFirebaseAssistantProvider not implemented — Phase 5'),
    );
  }

  // eslint-disable-next-line require-yield
  async *stream(_request: AssistantRequest): AsyncIterable<AssistantChunk> {
    throw new Error('VertexAIInFirebaseAssistantProvider not implemented — Phase 5');
  }
}

export const vertexAIAssistantProvider = new VertexAIInFirebaseAssistantProvider();
