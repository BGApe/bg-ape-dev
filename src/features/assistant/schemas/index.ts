import { z } from 'zod';

export const CollectionGameContextItemSchema = z.object({
  name: z.string().min(1),
  minPlayers: z.number().int().positive().optional(),
  maxPlayers: z.number().int().positive().optional(),
  playingTime: z.number().int().positive().optional(),
  averageWeight: z.number().positive().optional(),
  categories: z.array(z.string()).optional(),
  mechanics: z.array(z.string()).optional(),
  playCount: z.number().int().nonnegative().optional(),
  daysSinceLastPlay: z.number().int().nonnegative().optional(),
});

export const AssistantHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1_000),
});

export const AssistantRequestSchema = z.object({
  text: z.string().min(1),
  intent: z.enum(['recommendation', 'quick_guide', 'generic']),
  threadReason: z.enum(['recommendation', 'setup', 'rules', 'general']),
  isFirstMessage: z.boolean(),
  collectionContext: z.array(CollectionGameContextItemSchema).max(80).optional(),
  activityBias: z.enum(['none', 'undereplayed', 'favorites', 'recent']).optional(),
  recentMessages: z.array(AssistantHistoryMessageSchema).max(20).optional(),
});

export const AssistantResponseSchema = z.object({
  type: z.enum(['recommendation', 'quick_guide', 'generic']),
  title: z.string().min(1),
  summary: z.string(),
  bullets: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AssistantChunkSchema = z.object({
  delta: z.string(),
  done: z.boolean(),
});

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
export type AssistantChunk = z.infer<typeof AssistantChunkSchema>;
