import { z } from 'zod';

export const AssistantRequestSchema = z.object({
  text: z.string().min(1),
  intent: z.enum(['recommendation', 'quick_guide', 'generic']),
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
