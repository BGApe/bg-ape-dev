/**
 * Centralized route constants.
 * Use these instead of string literals to get refactor-safety and autocomplete.
 */
export const Routes = {
  login: '/(public)/login',
  chat: '/(app)',
  account: '/(app)/account',
} as const;

export type Route = (typeof Routes)[keyof typeof Routes];
