/**
 * Cross-cutting TypeScript types.
 * Domain-specific types live in src/features/<domain>/types.ts.
 */

export type Maybe<T> = T | null | undefined;

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Branded type helper for nominal typing (e.g. UserId vs ThreadId). */
export type Brand<T, B> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type ThreadId = Brand<string, 'ThreadId'>;
export type MessageId = Brand<string, 'MessageId'>;
