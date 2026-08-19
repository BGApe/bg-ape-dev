import appConfig from '@/config/appConfig';

import type { ChatRepository } from './ChatRepository';
import { firestoreChatRepository } from './FirestoreChatRepository';
import { inMemoryChatRepository } from './InMemoryChatRepository';

/**
 * Active chat repository, chosen at module load from config.
 * Flip `appConfig.chat.persistMessages` to switch between the Firestore-backed
 * repository (messages survive restarts) and the in-memory one (ephemeral).
 *
 * Consumers (hooks, orchestrator) import `chatRepository` — never a concrete
 * implementation — so the storage backend stays a single-point decision.
 */
export const chatRepository: ChatRepository = appConfig.chat.persistMessages
  ? firestoreChatRepository
  : inMemoryChatRepository;
