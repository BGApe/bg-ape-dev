import type { AssistantProvider } from '@/features/assistant/services/AssistantProvider';
import type {
  ActivityBias,
  AssistantHistoryMessage,
  CollectionGameContextItem,
  SetupDepth,
} from '@/features/assistant/types';
import { logger } from '@/services/logger';
import type { ThreadId, UserId } from '@/types';

import type { ChatRepository } from '../api/ChatRepository';
import { omitRepeatedSuggestions } from '../lib/suggestedGames';
import { assistantResponseToChatMessages } from '../mappers/assistantResponseMapper';
import type { ChatMessage, ChatReason } from '../types';

import { resolveIntent } from './intentResolver';

type ComposerActions = {
  appendStreamChunk: (chunk: string) => void;
  clearStream: () => void;
};

type AssistantTurnExtras = {
  collectionContext?: CollectionGameContextItem[];
  activityBias?: ActivityBias;
  gameContext?: CollectionGameContextItem;
  setupDepth?: SetupDepth;
  recentMessages?: AssistantHistoryMessage[];
  /** Titles already suggested in this thread. Repeated ones are dropped. */
  priorSuggestions?: string[];
  /** Follow-up block this turn belongs to, so it can collapse with its question. */
  segmentId?: string;
  segmentTitle?: string;
  discussionId?: string;
  discussionTitle?: string;
  discussionKind?: 'setup' | 'rules';
  versionName?: string;
  playerCount?: string;
};

/**
 * Orchestrates a full assistant turn:
 * intent resolution → streaming → message persistence.
 * Never imported by screen components — consumed via useSendMessage().
 */
export async function runAssistantTurn(
  text: string,
  threadId: ThreadId,
  uid: UserId,
  provider: AssistantProvider,
  repo: ChatRepository,
  composer: ComposerActions,
  threadReason: ChatReason = 'general',
  isFirstMessage: boolean = false,
  extras: AssistantTurnExtras = {},
): Promise<ChatMessage[]> {
  const intent = resolveIntent(text);

  const request = {
    text,
    intent,
    threadReason,
    isFirstMessage,
    ...(extras.collectionContext !== undefined
      ? { collectionContext: extras.collectionContext }
      : {}),
    ...(extras.activityBias !== undefined && extras.activityBias !== 'none'
      ? { activityBias: extras.activityBias }
      : {}),
    ...(extras.gameContext !== undefined ? { gameContext: extras.gameContext } : {}),
    ...(extras.setupDepth !== undefined ? { setupDepth: extras.setupDepth } : {}),
    ...(extras.recentMessages !== undefined && extras.recentMessages.length > 0
      ? { recentMessages: extras.recentMessages }
      : {}),
  };

  for await (const chunk of provider.stream(request)) {
    if (chunk.done) break;
  }

  composer.clearStream();

  const response = await provider.complete(request);
  const messages = omitRepeatedSuggestions(
    assistantResponseToChatMessages(response, threadId),
    extras.priorSuggestions ?? [],
  );

  const persisted: ChatMessage[] = [];
  for (const msg of messages) {
    const saved = await repo.addMessage(uid, threadId, {
      threadId: msg.threadId,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
      ...(msg.label !== undefined ? { label: msg.label } : {}),
      ...(msg.suggestedGames !== undefined ? { suggestedGames: msg.suggestedGames } : {}),
      ...(extras.segmentId !== undefined ? { segmentId: extras.segmentId } : {}),
      ...(extras.segmentTitle !== undefined ? { segmentTitle: extras.segmentTitle } : {}),
      ...(extras.discussionId !== undefined ? { discussionId: extras.discussionId } : {}),
      ...(extras.discussionTitle !== undefined ? { discussionTitle: extras.discussionTitle } : {}),
      ...(extras.discussionKind !== undefined ? { discussionKind: extras.discussionKind } : {}),
      ...(extras.versionName !== undefined ? { versionName: extras.versionName } : {}),
      ...(extras.playerCount !== undefined ? { playerCount: extras.playerCount } : {}),
    });
    persisted.push(saved);
  }

  logger.info('[assistantOrchestrator] turn complete', {
    intent,
    threadId,
    uid,
    messageCount: persisted.length,
    collectionSize: extras.collectionContext?.length ?? 0,
    hasGameContext: extras.gameContext !== undefined,
    setupDepth: extras.setupDepth ?? null,
    historySize: extras.recentMessages?.length ?? 0,
  });

  return persisted;
}
