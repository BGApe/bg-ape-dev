# BG Ape — Agent Handoff Document v4 → v5

> **For the incoming agent:** Read this entire document before touching any file.
> It is the single source of truth for project state as of **July 6, 2026**, after Phase 4
> (Android native build unblocked + app verified running on a physical device + first UI polish).
>
> - Supersedes `docs/version4-inprogress.md` for _current state_ (that file remains the detailed
>   blow-by-blow log; this file is the concise, actionable handover).
> - Cross-reference `docs/ARCHITECTURE.md` for design/layer rules and `docs/version3-handover.md`
>   for Phase 1–3 background.

---

## 1. Project overview

**BG Ape** is an Android-first React Native (Expo) board game companion app.
Current scope: email/password sign-in, user profile in Firestore, chat screen with a mock AI assistant.

- **Package manager:** pnpm 11.1.2 (must be on PATH)
- **Workspace root:** `Gameapp v1/` (note the space — always quote paths)
- **App package name:** `com.v1.boardgameapp` (dev variant: `com.v1.boardgameapp.dev`)
- **Firebase project:** `bg-ape` (project number `749490411897`, region `europe-west10`)
- **Deep-link scheme:** `bgape`
- **Expo SDK:** 55 · **React Native:** 0.83.6 · **React:** 19.2.0 (New Architecture / Fabric ON)

---

## 2. Current state — what's DONE (Phase 4 complete)

✅ **Android native build is unblocked.** `./gradlew assembleDebug` → BUILD SUCCESSFUL, produces
`android/app/build/outputs/apk/debug/app-debug.apk` (dev-client, all 4 ABIs + Hermes).

✅ **App runs on a physical device** — Samsung Galaxy S24 (SM-S921B, Android 16), loading JS live
from Metro. Fabric confirmed via logcat.

✅ **Auth works end-to-end** — login/signup functional; an **admin user exists in Firebase Auth**:
`admin@bgape.com` / `admin123`.

✅ **First UI polish (July 6)** — safe-area insets + composer fixes (see §5).

**The emulator is a dead end on the current Mac** (2017 dual-core / 8 GB → forced 1 vCPU). Use a
physical device. Do not spend time on the emulator.

---

## 3. ⚠️ CRITICAL GOTCHAS — read before building or running prebuild

These are landmines that will silently break the build/app if forgotten:

1. **Crashlytics native edits are wiped by `expo prebuild`.** The app crashes on launch
   (`IllegalStateException: The Crashlytics build ID is missing`) unless the Crashlytics Gradle
   plugin is applied. Two manual edits are currently in place and must be **re-applied after every
   `expo prebuild`** (until the permanent fix below):
   - `android/build.gradle` buildscript deps: `classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.2'`
   - `android/app/build.gradle`: `apply plugin: 'com.google.firebase.crashlytics'`
   - **Permanent Phase 5 fix:** add `@react-native-firebase/crashlytics` to the `plugins` array in
     `app.config.ts` (its config plugin wires the Gradle plugin automatically). See §6.3 of the
     Phase 5 list in `version4-inprogress.md`.

2. **`react-hook-form` is pinned to `7.74.0`.** Versions ≥ 7.75.0 have a regression that breaks
   `TextInput` typing on React Native (won't register keystrokes). **Do not bump it** without
   verifying typing still works on-device.

3. **`react-native-worklets@0.7.4` is a _direct_ dependency.** reanimated 4.x needs it resolvable
   from the project root; pnpm does not hoist it, so removing it breaks the reanimated Gradle build.
   Keep it in `package.json`.

4. **Dependencies are aligned to Expo SDK 55.** They were downgraded from bleeding-edge to what
   SDK 55 expects (RN 0.83.6, React 19.2.0, reanimated 4.2.1, screens 4.23.0, gesture-handler
   2.30.1, safe-area-context 5.6.2, flash-list 2.0.2, sentry ~7.11.0, async-storage 2.2.0,
   netinfo 11.5.2). Use `npx expo install --fix` — do **not** hand-pick newer versions; that's what
   caused the original `expo-modules-core` Kotlin (`Promise.kt`) compile failure.

5. **`edgeToEdgeEnabled=true`** in `android/gradle.properties` — the app draws behind the system
   bars. Any new full-screen screen **must** apply safe-area insets (see §5).

---

## 4. How to run on the device (repeatable)

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

# 1) phone plugged in, USB debugging authorized:
adb devices                              # must show "device" (not "unauthorized")

# 2) install the debug APK (only needed if native code changed; JS changes hot-reload)
adb install -r "android/app/build/outputs/apk/debug/app-debug.apk"

# 3) bridge phone -> Mac Metro, then start Metro
adb reverse tcp:8081 tcp:8081
pnpm start

# 4) point the dev client straight at Metro
adb shell am start -a android.intent.action.VIEW \
  -d "bgape://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Notes:

- It's a **debug / dev-client** build: keep Metro running; **JS-only changes hot-reload — no rebuild
  needed.** Only re-run `assembleDebug` + `adb install` when native code/config changes.
- If USB drops, re-run `adb reverse`.
- `rnfirebase.io/migrating-to-v22` warnings in logs are harmless deprecation notices.

---

## 5. UI polish applied July 6 (JS-only, hot-reloaded)

Problem: edge-to-edge drawing with no safe-area handling → top clipped, bottom composer under the
OS nav buttons; composer was a single row at the bottom.

- `src/providers/RootProviders.tsx` — mounted `<SafeAreaProvider>` (required for insets to work).
- `app/(app)/index.tsx` — chat screen pads by `useSafeAreaInsets()` (top+bottom), wraps content in
  `KeyboardAvoidingView`, and **centers the composer vertically** in the empty state.
- `src/features/chat/components/Composer.tsx` — input is now **≥3 rows** (`minHeight: 88`,
  `numberOfLines={3}`, `textAlignVertical: 'top'`, `maxHeight: 160`).
- `app/(app)/account.tsx` — same safe-area top/bottom padding.
- Fixed a latent typed-route error surfaced on Metro restart: `/(app)/` → `/(app)` in
  `app/(public)/_layout.tsx` and `src/constants/routes.ts`.

Open follow-up (design decision for next agent): the composer only centers in the _empty_ state;
once messages exist it moves to the bottom (standard chat). Confirm with the user whether they want
it centered always or a fixed height.

---

## 6. Git / working-tree state (as of this handover)

- Repo has a single commit: `777e4b0 chore: init repo`. **Essentially the entire project is
  untracked** (`git status` shows `src/`, `app/`, `functions/`, `docs/`, config files as `??`).
- **Nothing was committed during Phase 4** — all work lives in the working tree. Do **not** assume
  git history reflects the code. When the user asks to commit, expect a large initial add.
- `.env.development`, `.env.example` are untracked and contain config; do not commit secrets without
  the user's confirmation.

---

## 7. Gate checks — run before and after every batch

```bash
cd "Gameapp v1"
pnpm typecheck   # must exit 0   (currently GREEN)
pnpm lint        # must exit 0   (--max-warnings 0 enforced)
pnpm test        # must exit 0
```

---

## 8. What Phase 5 must build (summary — full detail in `version4-inprogress.md` §9)

The build blocker is gone, so Phase 5 feature work can start. Placeholder deps are installed but
**not wired**:

1. **Register dev Firebase app** (`com.v1.boardgameapp.dev`), refresh `google-services.json`, prebuild.
2. **Crashlytics full integration** — add to `app.config.ts` plugins (removes the manual §3.1 edits),
   wire `SentryLogger.captureException()` → `crashlytics().recordError()`.
3. **Google Sign-In** (Credential Manager) behind the existing `AuthProvider` interface.
4. **Remote Config** — `RemoteFlagProvider` on top of `featureFlags.ts`.
5. **VertexAI assistant** (real LLM) — implement provider + `assistantPing` Cloud Function, flip flag.
6. **i18n bootstrap** — `expo-localization` + `i18next`, route `copy.ts` through it.
7. **Branded assets** — replace placeholder icon/splash.
8. **Rate limiting** in `functions/src/assistant/assistantPing.ts` before launch.
9. **Store listing** — privacy policy, data safety form, screenshots, descriptions.

---

## 9. Operator rules (enforce strictly — unchanged from v3)

1. Work in batches of ~10 files max per turn; run the gate checks after each batch.
2. **Stop and ask before** installing any native module not already in `package.json`.
3. **Stop and ask before** modifying `app.config.ts`, `babel.config.js`, `tsconfig.json`,
   `metro.config.js`, or `package.json` scripts — propose the diff first.
4. **Stop and ask before** any `eas build`, Firebase console change, or secret generation.
5. No `any` in TypeScript (ESLint: `no-explicit-any: error`).
6. No Firebase imports in `app/**` or `src/components/**` — repositories only.
7. No business logic in JSX — screens consume hooks only.
8. No magic strings — copy via `src/constants/copy.ts`, routes via `src/constants/routes.ts`.
9. Every new Firestore document type needs a Zod schema at the repository boundary.
10. `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` are on — respect both.
