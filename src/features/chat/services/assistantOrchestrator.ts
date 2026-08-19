import type { AssistantProvider } from '@/features/assistant/services/AssistantProvider';
import { logger } from '@/services/logger';
import type { ThreadId, UserId } from '@/types';

import type { ChatRepository } from '../api/ChatRepository';
import { assistantResponseToChatMessages } from '../mappers/assistantResponseMapper';
import type { ChatMessage, ChatReason } from '../types';

import { resolveIntent } from './intentResolver';

type ComposerActions = {
  appendStreamChunk: (chunk: string) => void;
  clearStream: () => void;
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
): Promise<ChatMessage[]> {
  const intent = resolveIntent(text);

  for await (const chunk of provider.stream({ text, intent, threadReason, isFirstMessage })) {
    composer.appendStreamChunk(chunk.delta);
    if (chunk.done) break;
  }

  composer.clearStream();

  const response = await provider.complete({ text, intent, threadReason, isFirstMessage });
  const messages = assistantResponseToChatMessages(response, threadId);

  const persisted: ChatMessage[] = [];
  for (const msg of messages) {
    const saved = await repo.addMessage(uid, threadId, {
      threadId: msg.threadId,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    });
    persisted.push(saved);
  }

  logger.info('[assistantOrchestrator] turn complete', {
    intent,
    threadId,
    uid,
    messageCount: persisted.length,
  });

  return persisted;
}
