/**
 * Typed feature flags with local defaults.
 * In Phase 4, RemoteFlagProvider will layer Firebase Remote Config on top of these.
 * Components and use-cases consume flags via useFeatureFlags() hook (Phase 4).
 */

export type FeatureFlagConfig = {
  assistant: {
    /** Switch to VertexAIInFirebaseAssistantProvider when true. Default: false. */
    useRealProvider: boolean;
    /** Enable streaming UI path. Default: false. */
    enableStreaming: boolean;
  };
  chat: {
    /** Persist messages to Firestore. Default: false (InMemoryChatRepository). */
    persistMessages: boolean;
  };
  debug: {
    /** Show network request log overlay. Default: false. */
    showNetworkLog: boolean;
  };
};

export const defaultFeatureFlags: FeatureFlagConfig = {
  assistant: {
    useRealProvider: false,
    enableStreaming: false,
  },
  chat: {
    persistMessages: false,
  },
  debug: {
    showNetworkLog: false,
  },
};
