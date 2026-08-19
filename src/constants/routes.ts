/**
 * Centralized route constants.
 * Use these instead of string literals to get refactor-safety and autocomplete.
 */
export const Routes = {
  login: '/(public)/login',
  home: '/(app)',
  chat: '/(app)/chat',
  collection: '/(app)/collection',
  stats: '/(app)/stats',
  plays: '/(app)/plays',
  game: '/(app)/game',
  intent: '/(app)/intent',
  account: '/(app)/account',
} as const;

export type Route = (typeof Routes)[keyof typeof Routes];
