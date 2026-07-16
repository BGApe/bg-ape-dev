import { z } from 'zod';

export const SignInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export const SignUpSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  displayName: z.string().min(1, 'Display name is required.').max(50),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

export type SignInInput = z.infer<typeof SignInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
