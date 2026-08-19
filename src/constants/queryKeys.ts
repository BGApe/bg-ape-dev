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
    thread: (threadId: string) => ['chat', 'thread', threadId] as const,
    messages: (threadId: string) => ['chat', 'messages', threadId] as const,
  },
  collection: {
    all: ['collection'] as const,
    list: (uid: string) => ['collection', 'list', uid] as const,
  },
  plays: {
    all: ['plays'] as const,
    list: (uid: string) => ['plays', 'list', uid] as const,
  },
  bgg: {
    all: ['bgg'] as const,
    search: (query: string) => ['bgg', 'search', query] as const,
    thing: (bggId: number) => ['bgg', 'thing', bggId] as const,
  },
} as const;
