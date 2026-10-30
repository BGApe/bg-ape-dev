import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';

import { chatRepository } from '../api/activeChatRepository';
import type { ChatMessage, ChatThread } from '../types';

type ExchangeInput = {
  question: string;
  answer: string;
  label: string;
  segmentId: string;
  segmentTitle: string;
  discussionId?: string;
  discussionTitle?: string;
  discussionKind?: 'setup' | 'rules';
  versionName?: string;
  playerCount?: string;
};

/** Writes a stored question and answer into the open thread without calling the assistant. */
export function useRecordExchange(thread: ChatThread) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ExchangeInput): Promise<ChatMessage[]> => {
      const now = Date.now();
      const userMessage = await chatRepository.addMessage(thread.userId, thread.id, {
        threadId: thread.id,
        role: 'user',
        content: input.question,
        createdAt: now,
        label: input.label,
        segmentId: input.segmentId,
        segmentTitle: input.segmentTitle,
        ...(input.discussionId !== undefined ? { discussionId: input.discussionId } : {}),
        ...(input.discussionTitle !== undefined ? { discussionTitle: input.discussionTitle } : {}),
        ...(input.discussionKind !== undefined ? { discussionKind: input.discussionKind } : {}),
        ...(input.versionName !== undefined ? { versionName: input.versionName } : {}),
        ...(input.playerCount !== undefined ? { playerCount: input.playerCount } : {}),
      });
      const assistantMessage = await chatRepository.addMessage(thread.userId, thread.id, {
        threadId: thread.id,
        role: 'assistant',
        content: input.answer,
        createdAt: now + 1,
        segmentId: input.segmentId,
        segmentTitle: input.segmentTitle,
        ...(input.discussionId !== undefined ? { discussionId: input.discussionId } : {}),
        ...(input.discussionTitle !== undefined ? { discussionTitle: input.discussionTitle } : {}),
        ...(input.discussionKind !== undefined ? { discussionKind: input.discussionKind } : {}),
        ...(input.versionName !== undefined ? { versionName: input.versionName } : {}),
        ...(input.playerCount !== undefined ? { playerCount: input.playerCount } : {}),
      });
      return [userMessage, assistantMessage];
    },

    onSuccess(created) {
      queryClient.setQueryData<ChatMessage[]>(QueryKeys.chat.messages(thread.id), (prev) => {
        const list = prev ?? [];
        const ids = new Set(list.map((message) => message.id));
        return [...list, ...created.filter((message) => !ids.has(message.id))];
      });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.chat.threads(thread.userId) });
    },
  });
}
