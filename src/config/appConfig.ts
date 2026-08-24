import { env } from './env';

/**
 * Typed application configuration — central source of truth.
 * Avoids scattered literals. All limits, modes, and settings live here.
 */
const appConfig = {
  name: 'BG Ape' as const,
  env: env.EXPO_PUBLIC_ENV,
  region: 'europe-west10' as const,

  assistant: {
    /** Active provider — 'vertexAi' (Gemini 2.0 Flash via Cloud Function). */
    defaultMode: 'vertexAi' as const,
    maxMessageLength: 1_000,
    requestTimeoutMs: 30_000,
  },

  chat: {
    pageSize: 30,
    /** FirestoreChatRepository is wired — messages persist across restarts. */
    persistMessages: true,
  },

  profile: {
    displayNameMaxLength: 50,
  },
} as const;

export type AppConfig = typeof appConfig;
export default appConfig;
