/**
 * TanStack Query key factory — centralized to avoid key collisions and enable
 * targeted cache invalidation. All useQuery / useMutation hooks import from here.
 *
 * Pattern: keys are arrays so TanStack Query can match by prefix for invalidation.
 */
export const QueryKeys = {
  user: {
    all: ['user'] as const,
    profile: (uid: string) => ['user', 'profile', uid] as const,
  },
  chat: {
    all: ['chat'] as const,
    threads: (uid: string) => ['chat', 'threads', uid] as const,
    messages: (threadId: string) => ['chat', 'messages', threadId] as const,
  },
} as const;
