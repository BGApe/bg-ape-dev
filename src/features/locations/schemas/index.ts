import { z } from 'zod';

export const LocationSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number(),
});

export const NewLocationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
});

export type LocationInput = z.infer<typeof NewLocationSchema>;
