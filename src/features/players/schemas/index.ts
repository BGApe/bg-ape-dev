import { z } from 'zod';

export const PlayerSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  nickname: z.string().optional(),
  createdAt: z.number(),
});

export const NewPlayerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(60),
  nickname: z.string().trim().max(40).optional(),
});

export type PlayerInput = z.infer<typeof NewPlayerSchema>;
