import { defaultFeatureFlags } from '@/config/featureFlags';
import type { AssistantProvider } from '@/features/assistant/services/AssistantProvider';

import { mockAssistantProvider } from './MockAssistantProvider';
import { vertexAIAssistantProvider } from './VertexAIInFirebaseAssistantProvider';

/**
 * Selects the active AssistantProvider based on the feature flag.
 * Mirrors the pattern used by activeChatRepository.
 */
export const activeAssistantProvider: AssistantProvider = defaultFeatureFlags.assistant
  .useRealProvider
  ? vertexAIAssistantProvider
  : mockAssistantProvider;
