import { z } from 'zod';

/** Validates a Firestore users/{uid} document at the repository boundary. */
export const UserProfileSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string(),
  gamingNick: z.string().default(''),
  email: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const UpdateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required.')
    .max(50, 'Display name must be 50 characters or less.'),
  gamingNick: z.string().max(30, 'Nickname must be 30 characters or less.'),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
