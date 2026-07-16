# BG Ape — Target Architecture Design Document

> **Version:** 1.3 — Phase 4 in progress
> **Last updated:** May 17, 2026
> **Status:** Living document — updated at the end of each phase

---

## 1. Purpose and goals

This document describes the target architecture for BG Ape. It exists to:

- Give every contributor a shared mental model before touching code.
- Record _why_ each structural decision was made, not just what was built.
- Serve as a checklist for code review ("does this PR respect the layer boundaries?").
- Prevent architectural drift as the codebase grows across phases.

**Core architectural goal:** Add features as interchangeable modules. The app should never require replacing central logic to add a new capability.

---

## 2. High-level layer diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Expo Router (app/)                       │
│          Thin screen shells — JSX + navigation only          │
│  No business logic. No Firebase. No direct repo access.      │
└──────────────────────────┬──────────────────────────────────┘
                           │ consumes
┌──────────────────────────▼──────────────────────────────────┐
│                   Feature Hooks Layer                        │
│            src/features/<domain>/hooks/                      │
│  useQuery / useMutation wrapping repositories.               │
│  Optimistic updates, cache invalidation, error mapping.      │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls
┌──────────────────────────▼──────────────────────────────────┐
│               Use-Case / Orchestrator Layer                  │
│            src/features/<domain>/services/                   │
│  Pure business logic. No JSX. No framework coupling.         │
│  e.g. runAssistantTurn(), buildChatMessage()                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls
┌──────────────────────────▼──────────────────────────────────┐
│                   Repository Layer                           │
│            src/features/<domain>/api/                        │
│         src/backend/ for shared Firebase client              │
│  ONLY place that imports @react-native-firebase.             │
│  Returns plain Promise<T> or AsyncIterable<T>.               │
│  Validates every Firestore doc with Zod before returning.    │
└──────────────────────────┬──────────────────────────────────┘
                           │ reads/writes
┌──────────────────────────▼──────────────────────────────────┐
│             External Services / Firebase                     │
│  Firestore · Auth · App Check · Cloud Functions              │
│  Vertex AI in Firebase (via Callable Functions)              │
└─────────────────────────────────────────────────────────────┘
```

**Hard rules enforced by ESLint:**

| Rule                                                    | Enforcement                                 |
| ------------------------------------------------------- | ------------------------------------------- |
| No `@react-native-firebase` outside `src/backend/`      | Import path lint rule (Phase 2)             |
| No repository import in `app/**` or `src/components/**` | Same                                        |
| No `any`                                                | `@typescript-eslint/no-explicit-any: error` |
| Ordered imports                                         | `eslint-plugin-import` with groups          |

---

## 3. Folder structure — canonical reference

```
src/
├── config/              # Typed config — imported everywhere, no circular deps
│   ├── appConfig.ts     # All runtime limits, modes, feature defaults
│   ├── env.ts           # Zod parse of EXPO_PUBLIC_* at startup
│   ├── featureFlags.ts  # FeatureFlagConfig type + local defaults
│   └── firebaseConfig.ts# FIREBASE_REGION constant; Phase 2: app init export
│
├── constants/           # No magic strings
│   ├── copy.ts          # All user-facing copy (i18n key map)
│   ├── queryKeys.ts     # TanStack Query key factory (array-based)
│   └── routes.ts        # Typed route constants
│
├── features/            # One directory per domain
│   ├── auth/
│   │   ├── components/  # AuthForm, AuthButton, etc.
│   │   ├── hooks/       # useAuthSession(), useSignIn(), useSignOut()
│   │   ├── services/    # AuthProvider interface implementation
│   │   ├── schemas/     # Zod schemas for auth payloads
│   │   ├── types/       # AuthUser, Session, etc.
│   │   └── api/         # FirebaseAuthProvider (concrete)
│   ├── account/
│   │   ├── components/
│   │   ├── hooks/       # useUserProfileQuery(), useUpdateProfile()
│   │   ├── services/
│   │   ├── schemas/     # UserProfileSchema (Zod)
│   │   ├── types/       # UserProfile, AppUser
│   │   └── api/         # FirestoreUserProfileRepository
│   ├── chat/
│   │   ├── components/  # MessageBubble, MessageList, Composer
│   │   ├── hooks/       # useChatMessages(), useSendMessage()
│   │   ├── services/    # assistantOrchestrator, intentResolver
│   │   ├── schemas/     # ChatThreadSchema, ChatMessageSchema
│   │   ├── mappers/     # assistantResponse → ChatMessage[]
│   │   ├── types/       # ChatThread, ChatMessage, MessageRole
│   │   └── api/         # FirestoreChatRepository / InMemoryChatRepository
│   └── assistant/
│       ├── hooks/       # useAssistant()
│       ├── services/    # AssistantProvider interface
│       ├── schemas/     # AssistantRequestSchema, AssistantResponseSchema
│       └── types/       # AssistantRequest, AssistantResponse, AssistantChunk
│
├── components/          # Shared dumb UI components (no business logic)
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── ErrorBanner.tsx
│   ├── LoadingSpinner.tsx
│   └── OfflineBanner.tsx
│
├── services/            # Cross-cutting service interfaces
│   ├── logger/
│   │   ├── LoggerProvider.ts     # interface
│   │   ├── ConsoleLogger.ts      # dev/test implementation
│   │   └── SentryLogger.ts       # production implementation
│   ├── analytics/
│   │   ├── AnalyticsProvider.ts  # interface
│   │   └── FirebaseAnalytics.ts  # implementation
│   └── network/
│       └── NetInfoService.ts     # @react-native-community/netinfo wrapper
│
├── modules/             # Pluggable adapter implementations
│   └── assistant/
│       ├── MockAssistantProvider.ts           # deterministic, fake streaming
│       └── VertexAIInFirebaseAssistantProvider.ts  # stub until Phase 5
│
├── store/               # Zustand stores — one file per concern
│   ├── sessionStore.ts   # auth session, loading state
│   └── composerStore.ts  # chat input draft, sending state
│
├── lib/                 # Pure utilities — no side effects, no imports from src/
│   ├── mapError.ts       # unknown → UserFacingError
│   └── formatDate.ts     # date-fns wrappers (Phase 3)
│
├── hooks/               # Shared hooks used across features
│   ├── useFeatureFlags.ts # reads from Zustand + RemoteFlagProvider
│   └── useNetworkStatus.ts
│
├── providers/
│   └── RootProviders.tsx  # Composition root — order matters
│
├── types/
│   ├── index.ts           # Cross-cutting: UserId, ThreadId, Maybe<T>, etc.
│   └── nativewind.d.ts    # className ambient type extension
│
├── theme/
│   └── tokens.ts          # Design tokens — imported by tailwind.config.js
│
└── backend/              # Firebase client — the ONLY place RNFirebase is imported
    ├── firebase.ts        # App + AppCheck init (Phase 2)
    ├── firestore.ts       # Firestore instance + offline persistence (Phase 2)
    └── functions.ts       # Callable function client factory (Phase 2)
```

---

## 4. Provider interfaces

Every external service dependency is hidden behind a typed interface. Concrete implementations are injected via the provider root. This ensures:

- Unit tests use no-op / mock implementations without conditional imports.
- Real implementations can be swapped without touching consumers.
- Feature flags can control which implementation is active at runtime.

### 4.1 AuthProvider

```typescript
interface AuthProvider {
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(email: string, password: string): Promise<AppUser>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getSession(): Promise<AppUser | null>;
  onSessionChange(callback: (user: AppUser | null) => void): () => void;
}
```

**Beta implementation:** `FirebaseAuthProvider` (email + password)
**Phase 5:** `GoogleSignInAuthProvider` via Credential Manager (added behind the interface, no screen changes)

### 4.2 UserProfileRepository

```typescript
interface UserProfileRepository {
  get(uid: UserId): Promise<UserProfile | null>;
  createOrMerge(uid: UserId, data: Partial<UserProfile>): Promise<void>;
  update(uid: UserId, data: Partial<UserProfile>): Promise<void>;
}
```

**Implementation:** `FirestoreUserProfileRepository`
Profile is created on first sign-in via `setDoc({ merge: true })` — idempotent.

### 4.3 ChatRepository

```typescript
interface ChatRepository {
  getThread(threadId: ThreadId): Promise<ChatThread | null>;
  createThread(uid: UserId): Promise<ChatThread>;
  addMessage(threadId: ThreadId, message: Omit<ChatMessage, 'id'>): Promise<ChatMessage>;
  getMessages(threadId: ThreadId, cursor?: string): Promise<ChatMessage[]>;
  streamMessages(threadId: ThreadId): AsyncIterable<ChatMessage>;
}
```

**Beta implementation:** `InMemoryChatRepository` (flip to `FirestoreChatRepository` via `featureFlags.chat.persistMessages`)

### 4.4 AssistantProvider

```typescript
interface AssistantProvider {
  complete(request: AssistantRequest): Promise<AssistantResponse>;
  stream(request: AssistantRequest): AsyncIterable<AssistantChunk>;
}
```

**Beta:** `MockAssistantProvider` — deterministic structured payloads; fake streaming via timer
**Phase 5:** `VertexAIInFirebaseAssistantProvider` — invokes Cloud Function callable; App Check enforced

### 4.5 LoggerProvider

```typescript
interface LoggerProvider {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
}
```

**Dev/test:** `ConsoleLoggerProvider` (no-op in test env)
**Production:** `SentryLoggerProvider` — graceful no-op when `EXPO_PUBLIC_SENTRY_DSN` is absent

### 4.6 AnalyticsProvider

```typescript
interface AnalyticsProvider {
  track(event: string, properties?: Record<string, unknown>): void;
  identify(uid: UserId, traits?: Record<string, unknown>): void;
  screen(name: string, properties?: Record<string, unknown>): void;
}
```

**Implementation:** `FirebaseAnalyticsProvider` (no-op in tests)

### 4.7 Placeholder interfaces (architecture-ready, not implemented)

| Interface              | Purpose                              | Target implementation                      |
| ---------------------- | ------------------------------------ | ------------------------------------------ |
| `EntitlementsProvider` | Subscription status, feature unlocks | RevenueCat (`react-native-purchases`)      |
| `GameDataProvider`     | BGG game search, ratings, metadata   | BGG XML API v2 via Cloud Function proxy    |
| `MusicProvider`        | Spotify playlist suggestions         | Spotify Web API via Cloud Function         |
| `VisionProvider`       | Shelf scan, score-from-photo         | Google Cloud Vision API via Cloud Function |
| `RemoteFlagProvider`   | Server-driven feature flag overrides | Firebase Remote Config                     |

---

## 5. Data models and Zod schemas

All Firestore documents pass through `Schema.parse()` at the repository boundary. The app never works with unvalidated data from external sources.

### 5.1 Core types

```typescript
// src/types/index.ts
type UserId = Brand<string, 'UserId'>;
type ThreadId = Brand<string, 'ThreadId'>;
type MessageId = Brand<string, 'MessageId'>;

// src/features/account/types/
type UserProfile = {
  uid: UserId;
  displayName: string;
  email: string;
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number;
};

// src/features/chat/types/
type MessageRole = 'user' | 'assistant' | 'system';

type ChatMessage = {
  id: MessageId;
  threadId: ThreadId;
  role: MessageRole;
  content: string;
  createdAt: number;
  isOptimistic?: true; // present only on client-side optimistic inserts
};

type ChatThread = {
  id: ThreadId;
  userId: UserId;
  createdAt: number;
  updatedAt: number;
};

// src/features/assistant/types/
type AssistantResponseType = 'recommendation' | 'quick_guide' | 'generic';

type AssistantResponse = {
  type: AssistantResponseType;
  title: string;
  summary: string;
  bullets: string[];
  metadata?: Record<string, unknown>;
};

type AssistantChunk = {
  delta: string;
  done: boolean;
};
```

### 5.2 Zod schemas (Phase 3)

Each type above will have a corresponding `const XSchema = z.object({...})` in its feature's `schemas/` directory. The `z.infer<typeof XSchema>` type and the manually-defined type must remain in sync — prefer deriving the type from the schema:

```typescript
// Preferred pattern:
export const UserProfileSchema = z.object({ ... });
export type UserProfile = z.infer<typeof UserProfileSchema>;
```

---

## 6. Chat pipeline — assistant turn

```
User submits text
        │
        ▼
useSendMessage() hook
        │
        ├─── optimistic insert (local ChatMessage, isOptimistic: true)
        │
        ▼
assistantOrchestrator (use-case)
        │
        ├─── intentResolver(text) → 'recommendation' | 'quick_guide' | 'generic'
        │
        ├─── AssistantProvider.stream(request)  ← interface, not concrete
        │         │
        │         └── MockAssistantProvider (beta)
        │             VertexAIInFirebaseAssistantProvider (Phase 5)
        │
        ├─── assistantResponseToChatMessages(response) → ChatMessage[]
        │
        ├─── ChatRepository.addMessage(...)  ← InMemory (beta) / Firestore (Phase 2+)
        │
        └─── TanStack Query cache update → FlashList re-renders
```

**Streaming path:**

```
stream() returns AsyncIterable<AssistantChunk>
        │
for await (const chunk of stream) {
        │
        ├── append chunk.delta to a local buffer string
        ├── update Zustand composerStore.streamingContent
        └── when chunk.done === true → persist final message, clear buffer
}
```

**Error path:**

```
Any rejection in orchestrator
        │
        ├── mapError(error) → UserFacingError
        ├── LoggerProvider.captureException(error)
        └── useSendMessage returns { status: 'error', error: UserFacingError }
            → UI renders ErrorBanner with retry CTA
```

---

## 7. State management

### 7.1 Rule

| State type            | Owned by                              | Examples                                                 |
| --------------------- | ------------------------------------- | -------------------------------------------------------- |
| Server / async data   | TanStack Query                        | user profile, chat messages, assistant response          |
| UI / ephemeral        | Zustand                               | composer draft text, current thread id, streaming buffer |
| Sensitive session     | Zustand (`expo-secure-store` persist) | auth token (Phase 5 — not in beta)                       |
| Non-sensitive session | Zustand (`AsyncStorage` persist)      | last opened thread id                                    |

### 7.2 No duplicated state

Auth session is owned by `useAuthSession()`, backed by `AuthProvider.onSessionChange()`. It is **not** duplicated in a Zustand store or component local state. TanStack Query's user profile cache depends on the uid from this hook.

### 7.3 Query key factory

All `useQuery` and `useMutation` keys come from `src/constants/queryKeys.ts`:

```typescript
// Invalidate all user data:
queryClient.invalidateQueries({ queryKey: QueryKeys.user.all });

// Invalidate a specific profile:
queryClient.invalidateQueries({ queryKey: QueryKeys.user.profile(uid) });
```

---

## 8. Navigation and auth guards

```
app/
├── _layout.tsx            ← Root Stack, mounts RootProviders
├── (public)/
│   ├── _layout.tsx        ← if (session) router.replace('/(app)/')
│   └── login.tsx
└── (app)/
    ├── _layout.tsx        ← if (!session) router.replace('/(public)/login')
    ├── index.tsx          ← Chat
    └── account.tsx
```

Auth guard logic lives **only in the layout files**, nowhere else. Screens are protected implicitly by the group layout. Hooks receive a guaranteed-non-null session inside `(app)/`.

---

## 9. Firebase architecture

### 9.1 App Check

App Check is initialized **before any Firestore or Auth call**, in `app/_layout.tsx` before the Stack renders. The debug provider is used in `development` env; Play Integrity in `production`. No LLM callable may bypass App Check.

### 9.2 Firestore collections

```
users/{uid}
  └─ UserProfile document

chatThreads/{threadId}
  ├─ ChatThread document  (userId field matches Firestore rules)
  └─ messages/{messageId}
       └─ ChatMessage document
```

Security rules require `request.auth.uid == userId` for profile and thread access. See `firestore.rules` for the full ruleset.

### 9.3 Cloud Functions

**Location:** `functions/` (separate `package.json`, own `tsconfig.json`)
**Runtime:** Node.js 20, Gen 2
**Region:** `europe-west1` (pinned in `FIREBASE_REGION`)
**Transport:** HTTPS Callable (not HTTP triggers) for all client-facing functions

```
functions/src/
├── index.ts            # Function exports
└── assistant/
    └── assistantCall.ts  # Phase 5: Gemini via Vertex AI in Firebase
```

All callables enforce:

1. `context.auth` is present (Firebase Auth)
2. App Check token is valid
3. Rate limiting (TODO comment in stub — implemented before public launch)

### 9.4 Offline-first

Firestore's offline cache is enabled at init. `@react-native-community/netinfo` monitors connectivity. `OfflineBanner` component renders from `useNetworkStatus()` hook. No special offline-mode code required — Firestore handles it.

---

## 10. Observability

| Signal        | Tool                                | Where                                                 |
| ------------- | ----------------------------------- | ----------------------------------------------------- |
| Crashes       | Sentry via `SentryLoggerProvider`   | Global JS error boundary in `app/_layout.tsx`         |
| Errors        | `LoggerProvider.captureException()` | All `catch` blocks in use-cases and repositories      |
| Events        | `AnalyticsProvider.track()`         | sign-in, message sent, response received, error shown |
| Screens       | `AnalyticsProvider.screen()`        | Each screen's `useFocusEffect`                        |
| User identity | `AnalyticsProvider.identify(uid)`   | On session change in `useAuthSession()`               |

**Sentry graceful no-op:** If `EXPO_PUBLIC_SENTRY_DSN` is absent (e.g. in development without a Sentry project), `SentryLoggerProvider` falls back to `ConsoleLoggerProvider` internally. No crash.

---

## 11. Testing strategy

| Layer                     | What to test                                                     | Tools                                          |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| Schemas                   | Zod parse + error cases                                          | `jest` (pure — no React)                       |
| Mappers                   | Input → output determinism                                       | `jest` (pure)                                  |
| Use-cases / orchestrators | Business logic with mocked providers                             | `jest` + manual mocks                          |
| Hooks                     | Query state machine                                              | `@testing-library/react-native` + `renderHook` |
| Screens                   | User interaction flows                                           | `@testing-library/react-native`                |
| Repositories              | Not unit-tested directly; covered by integration tests (Phase 5) | —                                              |

**Required tests (Phase 3 — all passing ✅):**

1. `AssistantResponseSchema.parse()` — valid and invalid inputs (5 tests)
2. `assistantResponseToChatMessages()` mapper — both intents (4 tests)
3. `MockAssistantProvider.complete()` and `.stream()` — deterministic output (6 tests)

**Total: 15 tests, 3 suites, exit 0.**

**Test structure:** All tests live in `__tests__/` adjacent to the file they test, using the `*.test.ts(x)` suffix.

---

## 12. Security posture

| Threat                             | Mitigation                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| LLM cost abuse from forged clients | Firebase App Check (Play Integrity in prod) on all callables                                           |
| Secrets in bundle                  | Firebase config via `google-services.json` (not env vars); LLM keys only in Cloud Function environment |
| Unauthorized data access           | Firestore rules: `request.auth.uid == userId`; server-side enforcement                                 |
| Client-side business logic         | All LLM calls go through Cloud Functions — client never calls Vertex AI directly                       |
| Token theft                        | Firebase Auth tokens are short-lived; refresh handled by native SDK                                    |
| Rate limiting                      | TODO stubs in Cloud Functions — to be implemented before public launch                                 |

---

## 13. Future modules (placeholder interfaces defined, not implemented)

| Module            | Interface              | Dep (not installed until Phase 4)                            | Notes                                                             |
| ----------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Image recognition | `VisionProvider`       | `expo-camera`, `expo-image-picker`, `expo-image-manipulator` | Shelf scan, score-from-photo                                      |
| Reminders         | —                      | `expo-notifications`                                         | "Evening recommendation" push                                     |
| i18n              | —                      | `expo-localization`, `i18next`, `react-i18next`              | English-only in beta; all copy already routed through `copy.ts`   |
| Monetization      | `EntitlementsProvider` | `react-native-purchases` (RevenueCat)                        | Subscription gate on premium features                             |
| BGG integration   | `GameDataProvider`     | none (API via Cloud Function)                                | Game catalog, ratings, mechanics                                  |
| Spotify           | `MusicProvider`        | none (API via Cloud Function)                                | Soundtrack suggestions                                            |
| Remote config     | `RemoteFlagProvider`   | `@react-native-firebase/remote-config`                       | Server-driven feature flag overrides layered on `featureFlags.ts` |

---

## 14. Phase roadmap

### Phase 1 — Foundation ✅ Complete

Expo scaffold, TypeScript strict, NativeWind, config layer, routing skeleton, tokens, ESLint/Prettier/Husky.

### Phase 2 — Core platform ✅ Complete

`@react-native-firebase` suite (Auth, Firestore, AppCheck, Analytics), Sentry, TanStack Query client, Zustand stores, NetInfo, `mapError`, Cloud Functions scaffold with `assistantPing` callable stub, protected route layouts wired to `useAuthSession()`.

### Phase 3 — Beta features ✅ Complete

Full chat domain: types, Zod schemas, `AssistantProvider` interface, `MockAssistantProvider` (complete + streaming), `VertexAIInFirebaseAssistantProvider` stub, intent resolver, `assistantOrchestrator`, chat screen with `FlatList` + composer (FlashList swap deferred to Phase 4), account screen (profile read/edit + sign-out), login screen (sign-in + sign-up toggle). Required test suite (15 tests, 3 suites) green.

**Caveat:** Chat screen uses `FlatList` not `@shopify/flash-list`. FlashList swap is a Phase 4 task requiring a dev-client rebuild and explicit approval.

### Phase 4 — Hardening 🔄 In progress

Install future-feature placeholder deps (unused stubs), EAS build profiles (`eas.json` created), Firestore rules deployed, FlashList swap, full README + this architecture doc updated, `pnpm typecheck && pnpm lint && pnpm test` CI-ready with `--frozen-lockfile`.

### Phase 5 — Public-launch readiness ⬜ Queued

Google Sign-In via Credential Manager, Crashlytics full integration, Remote Config wiring, Privacy Policy + Data Safety form, EAS Update / OTA channel, full i18n bootstrap, store listing assets, rate limiting in Cloud Functions.

---

## 15. Key decisions log

| #   | Decision                                        | Alternatives considered                    | Rationale                                                                                                                                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `@react-native-firebase` over `firebase` JS SDK | Firebase JS SDK + AsyncStorage persistence | Native SDK provides: native session persistence (no AsyncStorage workaround), native App Check Play Integrity provider, Crashlytics, Remote Config — none of which the JS SDK handles robustly on Android |
| 2   | Expo Router v3 over React Navigation            | React Navigation v6                        | File-based routing reduces boilerplate; group-based auth guards are cleaner; typed routes catch broken links at compile time                                                                              |
| 3   | NativeWind v4 + Tailwind v3 (not Tailwind v4)   | Pure StyleSheet, Tailwind v4               | NativeWind v4's Metro integration uses Tailwind v3's PostCSS-based API; Tailwind v4's CSS-first config is incompatible with how NativeWind intercepts styles at build time                                |
| 4   | `MockAssistantProvider` default                 | Direct Gemini API call from client         | LLM API keys must never ship in the JS bundle; all AI calls go through Cloud Functions with App Check enforcement                                                                                         |
| 5   | `InMemoryChatRepository` first                  | Firestore from day 1                       | Same interface; avoids Firestore rules complexity until Auth is working; flip via `featureFlags.chat.persistMessages`                                                                                     |
| 6   | TanStack Query v5 for server state              | SWR, Apollo, custom hooks                  | Best-in-class cache invalidation, optimistic updates, DevTools, key factory pattern — well-suited to Firestore's query model                                                                              |
| 7   | Zod at every external boundary                  | TypeScript type assertions (`as`)          | Fail-fast on bad Firestore document shapes; prevent `any` from leaking through; enables exhaustive parse error reporting                                                                                  |
| 8   | `exactOptionalPropertyTypes: true`              | Disabled                                   | Forces developers to omit optional keys rather than assign `undefined`, closing a subtle class of runtime bugs in serialization                                                                           |
| 9   | `noUncheckedIndexedAccess: true`                | Disabled                                   | Forces null checks on all array and object index accesses — especially important for Firestore query results                                                                                              |
| 10  | Cloud Functions Gen 2, HTTPS Callable           | REST endpoints, Edge Functions             | Callable functions automatically handle App Check token verification; Gen 2 has better cold start performance; no CORS config needed                                                                      |
