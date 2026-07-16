import type { AssistantChunk, AssistantRequest, AssistantResponse } from '../types';

export interface AssistantProvider {
  complete(request: AssistantRequest): Promise<AssistantResponse>;
  stream(request: AssistantRequest): AsyncIterable<AssistantChunk>;
}
