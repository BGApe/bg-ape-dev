# BG Ape — Agent Handoff Document

> **For the incoming agent:** Read this entire document before touching any file.
> It is the single source of truth for project state as of **May 17, 2026**.
> Cross-reference with `docs/ARCHITECTURE.md` for design decisions and layer rules.

---

## 1. Project overview

**BG Ape** is an Android-first React Native board game companion app.
Beta scope: email/password sign-in, user profile in Firestore, chat screen with a mock AI assistant.

- **Package manager:** pnpm 11.1.2 (`pnpm` must be on PATH — install via `npm install -g pnpm` or `~/.local/bin/pnpm`)
- **Workspace root:** `Gameapp v1/` (note the space — always quote paths)
- **App package name:** `com.v1.boardgameapp`
- **Firebase project:** `bg-ape` (project number: `749490411897`)
- **Firebase region:** `europe-west10` (Berlin)

---

## 2. Gate checks — run before and after every batch

```bash
export PATH="$HOME/.local/bin:$PATH"   # pnpm is at ~/.local/bin/pnpm
cd "Gameapp v1"

pnpm typecheck   # must exit 0
pnpm lint        # must exit 0 (--max-warnings 0 enforced)
pnpm test        # must exit 0 (--passWithNoTests until Phase 3 tests are written)
```

All three must be green before committing or starting the next batch.
**Fix any red before proceeding — do not skip.**

---

## 3. Operator rules (enforce strictly)

1. Work in batches of ~10 files maximum per turn.
2. Run the three gate checks after each batch.
3. **Stop and ask before** installing any native module not already in `package.json`.
4. **Stop and ask before** modifying `app.config.ts`, `babel.config.js`, `tsconfig.json`, `metro.config.js`, or `package.json` scripts — propose the diff first.
5. **Stop and ask before** any `eas build` run, Firebase console change, or secret generation.
6. No `any` in TypeScript. ESLint enforces `@typescript-eslint/no-explicit-any: error`.
7. No Firebase imports in `app/**` or `src/components/**` — repositories only.
8. No business logic in JSX — screens consume hooks only.
9. No magic strings — copy via `src/constants/copy.ts`, routes via `src/constants/routes.ts`.
10. Every new Firestore document type needs a Zod schema at the repository boundary.
11. `exactOptionalPropertyTypes: true` is on — never assign `undefined` to an optional key; omit it instead.
12. `noUncheckedIndexedAccess: true` is on — all array/object index access returns `T | undefined`; explicit null checks required.

---

## 4. Current phase status

| Phase                 | Scope                                                                                                          | Status                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **1 — Foundation**    | Expo scaffold, TypeScript strict, NativeWind, config layer, routing skeleton, ESLint/Prettier/Husky            | ✅ Complete              |
| **2 — Core platform** | Firebase Auth, Firestore, App Check, Zustand, TanStack Query, Sentry, Analytics, NetInfo, Cloud Functions stub | ✅ Complete              |
| **3 — Beta features** | Chat domain, mock assistant, chat screen (FlashList), account screen, 3 required tests                         | ⬜ **Next — start here** |
| **4 — Hardening**     | Placeholder deps, EAS profiles, README update, test suite green                                                | ⬜ Queued                |
| **5 — Public launch** | Google Sign-In, Crashlytics, Remote Config, i18n, store listing                                                | ⬜ Queued                |

---

## 5. Exact verified state (May 17, 2026)

### Gate checks

```
pnpm typecheck   ✅  0 errors
pnpm lint        ✅  0 warnings, 0 errors
pnpm test        ✅  passed (no tests yet)
```

### Installed dependencies (package.json `dependencies`)

```
@react-native-async-storage/async-storage  ^3.0.2
@react-native-community/netinfo            ^12.0.1
@react-native-firebase/analytics           ^24.0.0
@react-native-firebase/app                 ^24.0.0
@react-native-firebase/app-check          ^24.0.0
@react-native-firebase/auth               ^24.0.0
@react-native-firebase/firestore          ^24.0.0
@react-native-firebase/functions          ^24.0.0
@sentry/react-native                      ^8.11.1
@tanstack/react-query                     ^5.100.10
expo                                      ~55.0.0
expo-constants                            ~55.0.0
expo-dev-client                           ~55.0.0
expo-router                               ~55.0.0
expo-status-bar                           ~2.2.0
nativewind                                ^4.2.3   (requires tailwindcss ^3, NOT v4)
react                                     19.2.6
react-native                              0.85.3
react-native-gesture-handler              ~2.31.2
react-native-reanimated                   ~4.3.1
react-native-safe-area-context            ~5.7.0
react-native-screens                      ~4.25.0
zod                                       ^4.4.3
zustand                                   ^4.5.7
```

### Source files created (all in `src/`)

```
src/backend/
  firebase.ts          — App Check init (debug provider in __DEV__, Play Integrity in prod)
  firestore.ts         — Firestore instance export
  functions.ts         — callable<TData,TResult>(name) factory, pinned to FUNCTIONS_REGION
  queryClient.ts       — TanStack Query QueryClient singleton

src/config/
  appConfig.ts         — runtime config (region, limits, modes)
  env.ts               — Zod-validated EXPO_PUBLIC_* at boot
  featureFlags.ts      — FeatureFlagConfig type + local defaults
  firebaseConfig.ts    — FIREBASE_REGION = 'europe-west10', FUNCTIONS_REGION = 'europe-west10'

src/constants/
  copy.ts              — all user-facing text (i18n-ready)
  queryKeys.ts         — TanStack Query key factory
  routes.ts            — typed route constants

src/features/auth/
  types/index.ts       — AppUser, AuthStatus
  schemas/index.ts     — SignInSchema, SignUpSchema, ResetPasswordSchema (Zod)
  services/AuthProvider.ts     — AuthProvider interface
  api/FirebaseAuthProvider.ts  — concrete implementation (signIn/signUp/signOut/reset/onSessionChange)
  hooks/useAuthSession.ts      — reads from Zustand sessionStore
  hooks/useSignIn.ts           — useMutation wrapping firebaseAuthProvider.signIn
  hooks/useSignOut.ts          — useMutation, clears TanStack Query cache on success
  components/SessionProvider.tsx — subscribes to onSessionChange, populates sessionStore

src/features/account/
  types/index.ts       — UserProfile, UpdateProfileInput
  schemas/index.ts     — UserProfileSchema, UpdateProfileSchema (Zod)
  api/UserProfileRepository.ts              — interface
  api/FirestoreUserProfileRepository.ts     — Zod-validated get/createOrMerge/update
  hooks/useUserProfileQuery.ts              — useQuery wrapping repository.get
  hooks/useUpdateProfile.ts                 — useMutation, invalidates profile cache

src/services/
  logger/LoggerProvider.ts     — interface
  logger/ConsoleLogger.ts      — dev/test implementation
  logger/SentryLogger.ts       — production (graceful no-op when DSN absent), initSentry()
  logger/index.ts              — exports `logger` singleton (picks impl by env)
  analytics/AnalyticsProvider.ts   — interface + noopAnalytics
  analytics/FirebaseAnalytics.ts   — firebaseAnalytics singleton
  analytics/index.ts
  network/NetInfoService.ts    — subscribeToNetInfo(), useNetworkStatus() hook

src/store/
  sessionStore.ts      — Zustand: { user, isLoading, setUser, setLoading }
  composerStore.ts     — Zustand: { draft, isSending, streamingContent, ... }

src/lib/
  mapError.ts          — mapError(unknown) → UserFacingError, handles Firebase auth codes

src/providers/
  RootProviders.tsx    — composes QueryClientProvider + FirebaseBootstrap + SessionProvider

src/theme/
  tokens.ts            — colors, spacing, radius, typography tokens

src/types/
  index.ts             — UserId, ThreadId, MessageId, Maybe<T>, Brand<T,B>
  nativewind.d.ts      — /// <reference types="nativewind/types" />
```

### App screens (all in `app/`)

```
app/_layout.tsx               — mounts RootProviders, imports global.css
app/(public)/_layout.tsx      — auth guard: redirects to /(app)/ if authenticated
app/(public)/login.tsx        — placeholder (TODO Phase 3: real form)
app/(app)/_layout.tsx         — auth guard: redirects to /(public)/login if unauthenticated
app/(app)/index.tsx           — chat placeholder (TODO Phase 3)
app/(app)/account.tsx         — account placeholder (TODO Phase 3)
```

### Cloud Functions (in `functions/`)

```
functions/package.json        — firebase-functions v6, firebase-admin v13, node 20
functions/tsconfig.json       — CommonJS, strict, noUncheckedIndexedAccess
functions/src/index.ts        — exports assistantPing
functions/src/assistant/assistantPing.ts — stub callable, enforceAppCheck: true, region: europe-west10
```

### Other root files

```
app.config.ts     — plugins: expo-router, expo-dev-client, @react-native-firebase/app,
                    @react-native-firebase/auth, @react-native-firebase/app-check
.env.example      — template; EXPO_PUBLIC_ENV + EXPO_PUBLIC_SENTRY_DSN
.env.development  — EXPO_PUBLIC_ENV=development
google-services.json — Firebase credentials (git-ignored, already present in project root)
firestore.rules   — written, not yet deployed
firestore.indexes.json
tailwind.config.js — token-referenced, uses nativewind/preset
global.css         — @tailwind base/components/utilities
```

---

## 6. What Phase 3 must build

Phase 3 = **Beta features**. All three gate checks must be green at the end.

### 6.1 Chat domain types and schemas

Create in `src/features/chat/`:

```
types/index.ts     — ChatThread, ChatMessage (MessageRole: 'user'|'assistant'|'system'),
                     ChatIntent ('recommendation'|'quick_guide'|'generic')
schemas/index.ts   — ChatThreadSchema, ChatMessageSchema (Zod, validated at repo boundary)
```

### 6.2 Assistant domain

Create in `src/features/assistant/`:

```
types/index.ts     — AssistantRequest, AssistantResponse, AssistantChunk
schemas/index.ts   — AssistantRequestSchema, AssistantResponseSchema (Zod)
```

`AssistantResponse` shape:

```typescript
type AssistantResponse = {
  type: 'recommendation' | 'quick_guide' | 'generic';
  title: string;
  summary: string;
  bullets: string[];
  metadata?: Record<string, unknown>;
};
AssistantChunk = { delta: string; done: boolean };
```

### 6.3 AssistantProvider interface + implementations

`src/features/assistant/services/AssistantProvider.ts`:

```typescript
interface AssistantProvider {
  complete(request: AssistantRequest): Promise<AssistantResponse>;
  stream(request: AssistantRequest): AsyncIterable<AssistantChunk>;
}
```

`src/modules/assistant/MockAssistantProvider.ts`:

- `complete()` returns deterministic structured payloads for both intents
- `stream()` yields `AssistantChunk`s on a timer (fake streaming)

`src/modules/assistant/VertexAIInFirebaseAssistantProvider.ts`:

- Stub class with TODO body, behind `featureFlags.assistant.useRealProvider`

### 6.4 Intent resolver

`src/features/chat/services/intentResolver.ts`:

- Pure function: `resolveIntent(text: string): ChatIntent`
- Keyword heuristic for beta (no ML needed)
- Swappable later without UI changes

### 6.5 Assistant orchestrator (use-case)

`src/features/chat/services/assistantOrchestrator.ts`:

- `runAssistantTurn(request, provider, chatRepo, composerStore) → Promise<void>`
- Pipeline: intent → provider.stream() → append chunks → persist final message
- Never imported by screen components directly — consumed via `useSendMessage()`

### 6.6 Chat repository

`src/features/chat/api/ChatRepository.ts` (interface):

```typescript
interface ChatRepository {
  getOrCreateThread(uid: UserId): Promise<ChatThread>;
  addMessage(threadId: ThreadId, message: Omit<ChatMessage, 'id'>): Promise<ChatMessage>;
  getMessages(threadId: ThreadId): Promise<ChatMessage[]>;
}
```

`src/features/chat/api/InMemoryChatRepository.ts` — default implementation (no Firestore).
Flip to `FirestoreChatRepository` when `featureFlags.chat.persistMessages = true`.

### 6.7 Chat hooks

```
src/features/chat/hooks/useChatMessages.ts  — useQuery wrapping chatRepository.getMessages
src/features/chat/hooks/useSendMessage.ts   — orchestrates optimistic insert + assistantOrchestrator
```

### 6.8 Chat screen — `app/(app)/index.tsx`

Replace the placeholder with:

- `@shopify/flash-list` message list (install triggers **stop-and-ask gate**)
- Input composer with `disabled` / `sending` / `error` states
- Optimistic user message insert
- Streaming assistant response rendered chunk-by-chunk from `composerStore.streamingContent`
- Empty state copy from `Copy.chat.emptyState`
- Error banner on failure

### 6.9 Account screen — `app/(app)/account.tsx`

Replace the placeholder with:

- Profile read via `useUserProfileQuery()`
- Display name edit via React Hook Form + Zod (`UpdateProfileSchema`)
  - Install `react-hook-form` + `@hookform/resolvers` (**stop-and-ask gate for non-pinned deps**)
  - Actually: both are in the original spec so no gate — install directly
- Sign-out button via `useSignOut()`
- Loading / error states

### 6.10 Login screen — `app/(public)/login.tsx`

Replace the placeholder with:

- Email + password form via React Hook Form + Zod (`SignInSchema`)
- Sign-in button via `useSignIn()`
- Link to sign-up (can be same screen, toggled) via `firebaseAuthProvider.signUp`
- Error banner mapping Firebase error codes (already handled in `mapError`)
- On success: navigation is automatic (auth guard redirects)

### 6.11 Profile creation on first sign-in

Wire in `SessionProvider.tsx` or a dedicated hook:

- When `onSessionChange` fires with a new user, call `firestoreUserProfileRepository.createOrMerge(uid, { email, displayName })`
- This is idempotent — safe to call on every sign-in

### 6.12 Required test suite (Phase 3 mandatory)

Create these three tests — all must be green for Phase 3 to close:

```
src/features/assistant/__tests__/AssistantResponseSchema.test.ts
  — parse valid AssistantResponse → success
  — parse missing required field → ZodError

src/features/chat/__tests__/assistantResponseMapper.test.ts
  — mapper maps 'recommendation' response → ChatMessage[]
  — mapper maps 'quick_guide' response → ChatMessage[]

src/modules/assistant/__tests__/MockAssistantProvider.test.ts
  — complete() returns deterministic AssistantResponse for both intents
  — stream() yields chunks and terminates with done: true
```

---

## 7. Packages to install in Phase 3

These are already in the original spec — no stop-and-ask gate needed for the first two.
The third one (`@shopify/flash-list`) IS a stop-and-ask gate item.

| Package               | Gate                | Reason                                          |
| --------------------- | ------------------- | ----------------------------------------------- |
| `react-hook-form`     | ❌ no gate          | In original spec                                |
| `@hookform/resolvers` | ❌ no gate          | In original spec                                |
| `@shopify/flash-list` | ✅ **STOP AND ASK** | Native module — confirm dev-client rebuild plan |

---

## 8. Key patterns to follow

### Import order (ESLint enforced, alphabetical within groups)

```typescript
// 1. External packages
import { useQuery } from '@tanstack/react-query';
import type React from 'react';

// 2. Internal @/* aliases (blank line between groups)
import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

// 3. Relative imports
import type { ChatMessage } from '../types';
```

### Zod schema pattern

```typescript
// Derive the type FROM the schema — don't define both separately
export const ChatMessageSchema = z.object({ ... });
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
```

### exactOptionalPropertyTypes pattern

```typescript
// ❌ WRONG — assigns undefined explicitly
return { message, code: undefined };

// ✅ CORRECT — omit the key entirely
return code !== undefined ? { message, code } : { message };
```

### Repository boundary pattern

```typescript
// Every Firestore read must pass through Schema.parse before returning
const raw = snap.data();
const parsed = ChatMessageSchema.safeParse({ ...raw, id: snap.id });
if (!parsed.success) {
  logger.warn('[ChatRepo] Schema mismatch', { issues: parsed.error.issues });
  return null;
}
return parsed.data;
```

### No-any rule

If you find yourself writing `as any`, stop and find the proper type.
`as TResult` is acceptable when you own the generic contract (see `functions.ts`).

---

## 9. Environment and tooling notes

- **pnpm not on system PATH** — must run `export PATH="$HOME/.local/bin:$PATH"` first, or prefix commands with `/Users/macj/.local/bin/pnpm`
- **pnpm install requires `--ignore-scripts`** in the Cursor sandbox environment. On a real terminal or CI, run without the flag.
- **Java not installed** — `keytool` and Gradle commands will fail. Install via `brew install --cask temurin@17` when ready to run `expo prebuild`.
- **Homebrew not installed** — install first: paste the official install script from brew.sh.
- **App Check debug token** — on first Android run, the debug token prints to Metro/Android logs. Copy it to Firebase console → App Check → your app → Manage debug tokens.
- **google-services.json** — already present in project root, git-ignored. Never commit it.

---

## 10. Files NOT to touch without explicit approval

| File                               | Reason                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `app.config.ts`                    | Pinned — propose diff and wait for approval              |
| `babel.config.js`                  | Pinned                                                   |
| `tsconfig.json`                    | Pinned — especially do not loosen strict flags           |
| `metro.config.js`                  | Pinned                                                   |
| `package.json` scripts             | Pinned                                                   |
| `firestore.rules`                  | Only update via reviewed diff                            |
| `google-services.json`             | Never modify, never commit                               |
| `.env.development`                 | Contains no secrets — safe to commit; do not add secrets |
| `.env.staging` / `.env.production` | Git-ignored — do not create without approval             |

---

## 11. Reference documents

| Document                        | Path                         |
| ------------------------------- | ---------------------------- |
| Full architecture design        | `docs/ARCHITECTURE.md`       |
| Setup + scripts + decisions log | `README.md`                  |
| Firestore rules                 | `firestore.rules`            |
| Environment variables           | `.env.example`               |
| Design tokens                   | `src/theme/tokens.ts`        |
| All user-facing copy            | `src/constants/copy.ts`      |
| Route constants                 | `src/constants/routes.ts`    |
| Query key factory               | `src/constants/queryKeys.ts` |
