import { z } from 'zod';

import { callable } from '@/backend/functions';

const RulesFaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const GameplayQuestionSchema = z.object({
  topic: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const BggGameProfileSchema = z.object({
  bggId: z.number().int().positive(),
  name: z.string().min(1),
  yearPublished: z.number().int().optional(),
  minPlayers: z.number().int().optional(),
  maxPlayers: z.number().int().optional(),
  playingTime: z.number().int().optional(),
  averageWeight: z.number().optional(),
  bggRating: z.number().optional(),
  bggRank: z.number().int().optional(),
  thumbnailUrl: z.string().optional(),
  categories: z.array(z.string()).default([]),
  mechanics: z.array(z.string()).default([]),
  rulesFaq: z.array(RulesFaqItemSchema).default([]),
  gameplayQuestions: z.array(GameplayQuestionSchema).default([]),
  updatedAt: z.number(),
});

export type BggGameProfile = z.infer<typeof BggGameProfileSchema>;
export type RulesFaqItem = z.infer<typeof RulesFaqItemSchema>;

export type EnsureBggGameProfileInput = {
  bggId?: number;
  name?: string;
};

const ensureCallable = callable<EnsureBggGameProfileInput, unknown>('ensureBggGameProfile');

export type RecordGameplayQuestionInput = {
  bggId?: number;
  name: string;
  topic: string;
  question: string;
  answer: string;
};

const recordCallable = callable<RecordGameplayQuestionInput, unknown>('recordGameplayQuestion');

const RecordResultSchema = z.object({
  saved: z.literal(true),
  bggId: z.number().int().positive(),
});

/** Stores a solved rules question on the shared game profile. */
export async function recordGameplayQuestion(input: RecordGameplayQuestionInput): Promise<void> {
  const raw = await recordCallable(input);
  RecordResultSchema.parse(raw);
}

/**
 * Loads the shared game profile from the Cloud Function.
 * The function reads Firestore first and only calls BoardGameGeek when the
 * profile (metadata + rules FAQ) is missing.
 */
export async function ensureBggGameProfile(
  input: EnsureBggGameProfileInput,
): Promise<BggGameProfile> {
  const raw = await ensureCallable(input);
  return BggGameProfileSchema.parse(raw);
}
