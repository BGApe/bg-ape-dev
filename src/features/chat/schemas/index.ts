import { z } from 'zod';

export const ChatReasonSchema = z.enum(['recommendation', 'setup', 'rules', 'general']);

export const ChatThreadSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string(),
  reason: ChatReasonSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  gameId: z.string().optional(),
  gameName: z.string().optional(),
  lastMessagePreview: z.string().optional(),
  solvedSegmentIds: z.array(z.string().min(1).max(80)).max(200).optional(),
  gameKey: z.string().min(1).max(160).optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.number(),
  label: z.string().optional(),
  suggestedGames: z.array(z.string()).max(8).optional(),
  segmentId: z.string().min(1).max(80).optional(),
  segmentTitle: z.string().min(1).max(120).optional(),
  discussionId: z.string().min(1).max(80).optional(),
  discussionTitle: z.string().min(1).max(160).optional(),
  discussionKind: z.enum(['setup', 'rules']).optional(),
  versionName: z.string().min(1).max(120).optional(),
  playerCount: z.string().min(1).max(8).optional(),
});

export type ChatThread = z.infer<typeof ChatThreadSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
