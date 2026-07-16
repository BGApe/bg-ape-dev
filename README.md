# BG Ape — Board Game Companion App

Android-first mobile app for board game players: recommendations, quick-start rules guides, and more.

Built on a clean, layered architecture designed to grow — not to be rewritten.

---

## Quick links

| Document                 | Path                                             |
| ------------------------ | ------------------------------------------------ |
| Architecture & design    | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Firestore security rules | [`firestore.rules`](./firestore.rules)           |
| Environment variables    | [`.env.example`](./.env.example)                 |

---

## Tech stack

| Concern           | Technology                                                                        | Why                                                                 |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Runtime           | Expo SDK 55 + `expo-dev-client`                                                   | Expo Go not supported (native modules needed)                       |
| Framework         | React Native 0.85 / React 19                                                      | Android-first, future iOS support unblocked                         |
| Navigation        | Expo Router v3                                                                    | File-based routing, typed routes, group-based auth guards           |
| Language          | TypeScript 6 — strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | Maximum type safety at every boundary                               |
| Firebase Auth     | `@react-native-firebase/auth`                                                     | Native session persistence, Credential Manager (Phase 5)            |
| Database          | Cloud Firestore + `@react-native-firebase/firestore`                              | Offline-first, real-time, scales to public launch                   |
| App Check         | `@react-native-firebase/app-check`                                                | Prevents LLM cost abuse from day 1                                  |
| LLM backend       | Firebase Cloud Functions Gen 2 → Vertex AI in Firebase (Gemini)                   | No API key on device; App Check enforced; streaming-capable         |
| Server state      | TanStack Query v5                                                                 | Query-key factory, optimistic updates, cache invalidation           |
| UI state          | Zustand (with AsyncStorage persist)                                               | Lightweight, no boilerplate, composable stores                      |
| Styling           | NativeWind v4 + Tailwind CSS v3                                                   | Utility classes on RN components; token-driven theme                |
| Schema validation | Zod                                                                               | Every external boundary — Firestore docs, callable responses, forms |
| Forms             | React Hook Form + `@hookform/resolvers/zod`                                       | Typed, performant, Zod-integrated                                   |
| Chat list         | `@shopify/flash-list`                                                             | Performant recycled list for long message threads                   |
| Crash reporting   | `@sentry/react-native` behind `LoggerProvider`                                    | Graceful no-op when DSN absent                                      |
| Analytics         | `@react-native-firebase/analytics` behind `AnalyticsProvider`                     | No-op in tests                                                      |
| Offline UX        | `@react-native-community/netinfo`                                                 | "You're offline" banners                                            |
| Dates             | `date-fns`                                                                        | Locale-aware formatting (i18n-ready in Phase 4)                     |
| Testing           | `jest-expo` + `@testing-library/react-native`                                     | Expo-compatible preset                                              |
| Package manager   | pnpm 11                                                                           | Fast, strict, workspace-ready                                       |

---

## Prerequisites

| Tool           | Version | Install                                                       |
| -------------- | ------- | ------------------------------------------------------------- |
| Node.js        | 22+     | [nodejs.org](https://nodejs.org)                              |
| pnpm           | 11+     | `npm install -g pnpm`                                         |
| Android Studio | Latest  | [developer.android.com](https://developer.android.com/studio) |
| Java / JDK     | 17+     | bundled with Android Studio                                   |
| EAS CLI        | Latest  | `npm install -g eas-cli` (Phase 4)                            |

---

## Initial setup

```bash
# 1. Clone and enter the project
cd "Gameapp v1"

# 2. Install dependencies
pnpm install

# 3. Copy environment file
cp .env.example .env.development

# 4. Add Firebase credentials (Phase 2+)
#    Place google-services.json in the project root.
#    This file is git-ignored and must never be committed.

# 5. Generate native projects (Phase 2+)
npx expo prebuild --platform android

# 6. Start the dev client on a connected device or emulator
pnpm android
```

---

## Scripts

| Script           | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm start`     | Start Metro bundler                           |
| `pnpm android`   | Build and launch on Android device/emulator   |
| `pnpm typecheck` | TypeScript strict typecheck (no emit)         |
| `pnpm lint`      | ESLint — 0 warnings policy                    |
| `pnpm lint:fix`  | ESLint with auto-fix                          |
| `pnpm format`    | Prettier write pass                           |
| `pnpm test`      | Jest (watch=false) — 15 tests across 3 suites |

> All three gate checks must be green before proceeding to the next phase:
> `pnpm typecheck && pnpm lint && pnpm test`

---

## Environment variables

Only `EXPO_PUBLIC_*` prefixed variables are bundled into the JS bundle. **Never put secrets here.**

| Variable                 | Required | Description                                   |
| ------------------------ | -------- | --------------------------------------------- |
| `EXPO_PUBLIC_ENV`        | Yes      | `development` \| `staging` \| `production`    |
| `EXPO_PUBLIC_SENTRY_DSN` | No       | Sentry DSN — app no-ops gracefully without it |

Firebase credentials come from `google-services.json` (Android native SDK — not env vars).

Copy `.env.example` to `.env.development` for local work. `.env.staging` and `.env.production` are git-ignored.

---

## Firebase setup (Phase 2)

> Stop-and-ask gate: Do not proceed without confirming dev-client rebuild plan.

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Add an **Android app** with package name `com.v1.boardgameapp`.
3. Download `google-services.json` and place it in the project root.
4. Enable **Email/Password** auth in Firebase console → Authentication.
5. Enable **Cloud Firestore** in the Firebase console.
6. Enable **App Check** (debug provider for development, Play Integrity for production).
7. Deploy Firestore rules: `firebase deploy --only firestore:rules`.
8. Run `npx expo prebuild --platform android` to regenerate the native project.

---

## EAS Build setup (Phase 4)

> Stop-and-ask gate: Confirm before running `eas build` for the first time.

`eas.json` is present in the project root with three profiles: `development`, `preview`, and `production`.

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in
eas login

# Initialize (fills in projectId in app.config.ts extra.eas.projectId)
eas init

# Build development client (APK for internal distribution)
eas build --platform android --profile development

# Build preview APK
eas build --platform android --profile preview

# Build production AAB for Play Store
eas build --platform android --profile production
```

`eas build` and `eas init` are stop-and-ask gates — do not run without explicit approval.

---

## Phase status

| Phase                           | Scope                                                                                                                                                      | Status         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **1 — Foundation**              | Project scaffold, TypeScript, NativeWind, config layer, routing skeleton, ESLint/Prettier/Husky                                                            | ✅ Complete    |
| **2 — Core platform**           | Firebase native modules, Auth, Firestore, App Check, Zustand, TanStack Query, Sentry, Analytics, NetInfo, Cloud Functions stub                             | ✅ Complete    |
| **3 — Beta features**           | Chat domain, schemas, AssistantProvider, MockAssistantProvider, intent resolver, orchestrator, chat screen, account screen, login screen, 15 tests passing | ✅ Complete    |
| **4 — Hardening**               | EAS profiles (`eas.json`), placeholder deps, Firestore rules deployed, README/ARCHITECTURE updated, CI-ready                                               | 🔄 In progress |
| **5 — Public-launch readiness** | Google Sign-In, Crashlytics, Remote Config, i18n, store listing assets                                                                                     | ⬜ Queued      |

### Known caveats (Phase 3 → Phase 4)

- **FlatList → FlashList:** The chat screen (`app/(app)/index.tsx`) uses `FlatList` rather than `@shopify/flash-list`. FlashList is a native module that requires a dev-client rebuild; it is scheduled for Phase 4 (pending approval of rebuild plan).
- **MockAssistantProvider timer warning:** `pnpm test` may print a "worker process has failed to exit gracefully" warning after the MockAssistantProvider suite. All 15 tests pass with exit code 0 — this is cosmetic. Root cause: fake streaming uses `setTimeout` which keeps the Node.js event loop alive briefly after tests complete. Safe to ignore until Phase 5.

---

## Project structure

```
Gameapp v1/
├── app/                          # Expo Router routes (thin shells only)
│   ├── _layout.tsx               # Root: mounts RootProviders
│   ├── (public)/                 # Unauthenticated group
│   │   ├── _layout.tsx           # Redirects to (app) if authed
│   │   └── login.tsx
│   └── (app)/                    # Authenticated group
│       ├── _layout.tsx           # Redirects to (public)/login if not authed
│       ├── index.tsx             # Chat screen
│       └── account.tsx
│
├── src/
│   ├── config/                   # Typed config — single source of truth
│   │   ├── appConfig.ts
│   │   ├── env.ts                # Zod-validated EXPO_PUBLIC_* at boot
│   │   ├── featureFlags.ts
│   │   └── firebaseConfig.ts
│   ├── constants/                # No magic strings
│   │   ├── copy.ts               # All user-facing text (i18n-ready)
│   │   ├── queryKeys.ts          # TanStack Query key factory
│   │   └── routes.ts
│   ├── features/                 # Domain modules (Phase 2/3)
│   │   ├── auth/
│   │   ├── account/
│   │   ├── chat/
│   │   └── assistant/
│   ├── components/               # Shared dumb UI components
│   ├── services/                 # Cross-cutting services (logger, analytics, network)
│   ├── modules/                  # Pluggable adapter implementations
│   │   └── assistant/            # mock/, vertexAi/
│   ├── store/                    # Zustand stores (one per concern)
│   ├── lib/
│   │   └── mapError.ts           # Error → UserFacingError
│   ├── hooks/                    # Shared hooks
│   ├── providers/
│   │   └── RootProviders.tsx     # Provider composition root
│   ├── types/
│   │   ├── index.ts              # Cross-cutting TS types
│   │   └── nativewind.d.ts       # className prop ambient types
│   ├── theme/
│   │   └── tokens.ts             # Design tokens (colors, spacing, radius, typography)
│   └── backend/                  # Firebase boundary (Phase 2)
│
├── functions/                    # Cloud Functions Gen 2 (Phase 2)
├── firestore.rules
├── firestore.indexes.json
├── app.config.ts                 # Expo config (env-aware name/package/splash)
├── babel.config.js               # NativeWind jsxImportSource + @/* aliases
├── metro.config.js               # withNativeWind wrapper
├── tailwind.config.js            # Token-referenced Tailwind config (v3)
├── global.css                    # Tailwind directives entry point
└── tsconfig.json                 # Strict + exactOptionalPropertyTypes + paths
```

---

## Code conventions

- **No Firebase imports outside `src/backend/`** — repositories only.
- **No direct repository imports in components** — consume via hooks.
- **No magic strings** — `copy.ts` for text, `routes.ts` for paths, `queryKeys.ts` for cache keys.
- **No `any`** — ESLint rule `@typescript-eslint/no-explicit-any` is set to `error`.
- **Typed imports** — `consistent-type-imports` enforced by ESLint.
- **Ordered imports** — `eslint-plugin-import` with alphabetized groups.
- **exactOptionalPropertyTypes** — omit optional keys entirely when undefined; do not assign `undefined` explicitly.
- **noUncheckedIndexedAccess** — all array/object index access returns `T | undefined`; explicit guards required.

---

## Key decisions log

| Decision                                               | Rationale                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `@react-native-firebase` over Firebase JS SDK          | Native session persistence, App Check Play Integrity provider, Crashlytics, Remote Config — all require native modules                     |
| Expo Router v3 over React Navigation                   | File-based routing with group-based auth guards; typed routes; future deep-link support                                                    |
| NativeWind v4 + Tailwind v3 (not Tailwind v4)          | NativeWind v4 requires Tailwind `>3.3.0` API; Tailwind v4 uses a CSS-first config that is incompatible with NativeWind's Metro integration |
| Zod at every boundary                                  | Fail-fast on bad data shapes from Firestore/Cloud Functions rather than propagating `any` silently                                         |
| Mock assistant provider default                        | LLM calls must never come from the client directly; the real provider goes through App Check–protected Cloud Functions                     |
| TanStack Query for server state / Zustand for UI state | Clear separation; no overlapping responsibilities; both are lightweight                                                                    |
| `exactOptionalPropertyTypes: true`                     | Forces explicit handling of missing keys vs present-undefined — eliminates an entire class of subtle bugs                                  |
