import { z } from 'zod';

const PlayParticipantSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  score: z.number().optional(),
  won: z.boolean(),
});

/** Validates a Firestore users/{uid}/plays/{playId} document at the repository boundary. */
export const PlaySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  gameName: z.string().min(1),
  gameId: z.string().optional(),
  playedAt: z.number(),
  // Location — new structured fields
  locationId: z.string().optional(),
  locationName: z.string().optional(),
  // Location — legacy free-text field (kept for backward compat)
  location: z.string().optional(),
  // Participants — new structured list
  participants: z.array(PlayParticipantSchema).optional(),
  // Legacy numeric player count (kept for backward compat)
  playerCount: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  note: z.string().optional(),
  // Game metadata snapshot (denormalized from collection at write time)
  gameCategories: z.array(z.string()).optional(),
  gameMechanics: z.array(z.string()).optional(),
  gameWeight: z.number().optional(),
  createdAt: z.number(),
});

/** Validates the log-a-play form fields. */
export const LogPlaySchema = z.object({
  gameName: z.string().trim().min(1, 'Game is required.'),
  playedAt: z.number(),
  locationName: z.string().trim().max(80).optional(),
  durationMinutes: z.number().int().positive().max(6_000).optional(),
  note: z.string().trim().max(500).optional(),
});

export type LogPlayInput = z.infer<typeof LogPlaySchema>;
