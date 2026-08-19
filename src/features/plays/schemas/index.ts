import { z } from 'zod';

/** Validates a Firestore users/{uid}/plays/{playId} document at the repository boundary. */
export const PlaySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  gameName: z.string().min(1),
  gameId: z.string().optional(),
  playedAt: z.number(),
  location: z.string().optional(),
  playerCount: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  note: z.string().optional(),
  createdAt: z.number(),
});

/** Validates the log-a-play form. Coerces numeric text inputs; game + date required. */
export const LogPlaySchema = z.object({
  gameName: z.string().trim().min(1, 'Game is required.'),
  playedAt: z.number(),
  location: z.string().trim().max(80).optional(),
  playerCount: z.number().int().positive().max(99).optional(),
  durationMinutes: z.number().int().positive().max(6000).optional(),
  note: z.string().trim().max(500).optional(),
});

export type LogPlayInput = z.infer<typeof LogPlaySchema>;
