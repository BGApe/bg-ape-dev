import { z } from 'zod';

export const ChatThreadSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.number(),
});

export type ChatThread = z.infer<typeof ChatThreadSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
