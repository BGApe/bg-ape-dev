import { z } from 'zod';

export const MyListItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(120),
  note: z.string().max(280).optional(),
  createdAt: z.number(),
});

export const NewMyListItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  note: z.string().trim().max(280).optional(),
});
