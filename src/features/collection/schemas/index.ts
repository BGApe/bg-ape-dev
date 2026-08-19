import { z } from 'zod';

/** Validates a users/{uid}/games/{gameId} document at the repository boundary. */
export const CollectionGameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.enum(['manual', 'scanner', 'bgg']),
  addedAt: z.number(),
  bggId: z.number().optional(),
  yearPublished: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  language: z.string().optional(),
  minPlayers: z.number().optional(),
  maxPlayers: z.number().optional(),
  playingTime: z.number().optional(),
  averageWeight: z.number().optional(),
  bggRating: z.number().optional(),
  bggRank: z.number().optional(),
  notes: z.string().optional(),
});

/** Validates manual add-game input from the UI. */
export const AddGameSchema = z.object({
  name: z.string().min(1, 'Game name is required.').max(120),
});

export type AddGameInput = z.infer<typeof AddGameSchema>;
