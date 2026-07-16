# BG Ape — Agent Handoff Document v4 (In Progress)

> **For the incoming agent:** Read this entire document before touching any file.
> It is the single source of truth for project state as of **May 17, 2026** — Phase 4 partially complete.
> Cross-reference with `docs/ARCHITECTURE.md` for design decisions and layer rules.
> `docs/version3-handover.md` covers the Phase 3 completion state and all operator rules — they still apply.

---

## 0. SESSION UPDATE — June 17 / July 4 / July 6, 2026 (READ FIRST)

### ✅ UI FIXES: safe-area insets + composer (July 6, 2026)

On-device the app drew **edge-to-edge** (`edgeToEdgeEnabled=true`) with **no safe-area handling**,
so content was clipped under the status bar (top) and the composer sat under the OS nav buttons
(bottom). Fixes (JS only, hot-reloaded via Metro — no rebuild needed):

- `src/providers/RootProviders.tsx`: mounted `<SafeAreaProvider>` (required for insets/SafeAreaView).
- `app/(app)/index.tsx`: chat screen now uses `useSafeAreaInsets()` for top+bottom padding, wraps in
  `KeyboardAvoidingView`, and **centers the composer vertically** in the empty state.
- `src/features/chat/components/Composer.tsx`: input is now **≥3 rows** (`minHeight: 88`,
  `numberOfLines={3}`, `textAlignVertical: 'top'`, `maxHeight: 160`).
- `app/(app)/account.tsx`: same safe-area top/bottom padding.
- Fixed a latent typed-route error that surfaced on Metro restart: `/(app)/` → `/(app)` in
  `app/(public)/_layout.tsx` and `src/constants/routes.ts`. `pnpm typecheck` is green.

### ✅✅ RUNNING ON A PHYSICAL DEVICE (July 6, 2026)

The app is **installed and running on a physical Samsung Galaxy S24 (SM-S921B, Android 16)**,
loading live from the Metro dev server. Confirmed via logcat:
`ReactNativeJS: Running "main" with {"rootTag":1,"fabric":true}` and
`Android Bundled ... expo-router/entry.js (2396 modules)`. Fabric/New Architecture is active.

**Startup-crash fix required (applied):** the freshly built debug APK installed fine but
**crashed on launch** with:
`java.lang.IllegalStateException: The Crashlytics build ID is missing ... Crashlytics Gradle
plugin is missing from your app's build configuration.`
Cause: `@react-native-firebase/crashlytics` is installed (placeholder), and Firebase eagerly
inits Crashlytics at startup, which needs a build ID that only the Crashlytics Gradle plugin
injects. Fix (direct native edits, then rebuilt `assembleDebug`):

- `android/build.gradle` buildscript deps: added
  `classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.2'`
- `android/app/build.gradle`: added `apply plugin: 'com.google.firebase.crashlytics'`
  ⚠️ **These two edits are wiped by `expo prebuild`.** Permanent Phase 5 fix: add
  `@react-native-firebase/crashlytics` to the `plugins` array in `app.config.ts` (its config
  plugin wires the Gradle plugin automatically). Reapply the manual edits after any prebuild
  until then.

**How to run it on the device (repeatable):**

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"; export PATH="$ANDROID_HOME/platform-tools:$PATH"
# 1) phone plugged in, USB debugging authorized:  adb devices  -> "device"
adb install -r "android/app/build/outputs/apk/debug/app-debug.apk"
adb reverse tcp:8081 tcp:8081            # bridge phone -> Mac Metro
pnpm start                                # start Metro (scheme is `bgape`)
# 2) point the dev client straight at Metro:
adb shell am start -a android.intent.action.VIEW \
  -d "bgape://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Notes: it's a **debug/dev-client** build — it opens the Expo Dev Launcher and loads JS from
Metro (keep Metro running; hot reload works). If the USB drops, re-run `adb reverse`. The
`rnfirebase.io/migrating-to-v22` warnings in logs are harmless deprecation notices.
Emulator on this Mac is a dead end (2017 dual-core / 8 GB → forced 1 vCPU); use a device.

**Phase 4 is functionally complete and verified running on hardware.** Next: Phase 5 (section 9).

---

### ✅ RESOLVED (July 4, 2026): Android build blocker is FIXED

`./gradlew assembleDebug` → **BUILD SUCCESSFUL in 51m 33s**, produced
`android/app/build/outputs/apk/debug/app-debug.apk` (229 MB, all 4 ABIs + Hermes + dev client).
`:expo-modules-core:compileDebugKotlin` also compiles clean (0 errors).
The full native pipeline (worklets, reanimated, gesture-handler, expo-modules-core C++) builds.

**Two fixes were required (both applied):**

1. Dependency alignment via `expo install --fix` (see below) — fixed the `Promise.kt` compile error.
2. Added missing peer dep `react-native-worklets@0.7.4` (reanimated 4.x requires it as a
   direct, resolvable dependency; pnpm doesn't hoist it, so reanimated's `build.gradle`
   `node --print require.resolve('react-native-worklets/package.json')` failed until it was
   added explicitly). Now in `package.json`.

Section 4's Options A/B/C are obsolete — leave for history. **Phase 4 is now complete: the app
builds and can be installed/run on a device/emulator.** Next work is Phase 5 (section 9).

---

This session diagnosed the Android build blocker (section 4) and applied the real fix.

### Root cause of the Android build failure (CONFIRMED)

The handoff's Options A/B/C (section 4) were all wrong guesses. The real cause is a
**dependency version mismatch**: `react-native@0.85.3` was installed, but Expo SDK 55
expects **`react-native@0.83.6`**. RN 0.85's `com.facebook.react.bridge.Promise`
interface changed its `reject(...)` signatures, so `expo-modules-core@55.0.25`'s
`Promise.kt` failed to compile (`'reject' overrides nothing` / class not abstract).
The full build was captured this time (44 min run) — error was in
`expo-modules-core/android/src/main/java/expo/modules/kotlin/Promise.kt`.

Also confirmed: **Option A (newArchEnabled=false) is impossible** — RN ≥ 0.82 ignores it.
Build log: _"Setting newArchEnabled=false ... is not supported anymore since React Native 0.82."_

### Fix applied this session

- Ran `npx expo install --fix` → aligned ~20 deps to the SDK 55 matrix. Key changes in
  `package.json` (confirmed installed in `node_modules` + lockfile updated):
  - `react-native` 0.85.3 → **0.83.6**
  - `react` 19.2.6 → **19.2.0**
  - `expo` ~55.0.0 → **~55.0.26**
  - `@shopify/flash-list` 2.3.1 → 2.0.2, `react-native-reanimated` → 4.2.1,
    `react-native-screens` → 4.23.0, `react-native-gesture-handler` → 2.30.1,
    `react-native-safe-area-context` → 5.6.2, `@sentry/react-native` 8.x → ~7.11.0,
    `@react-native-async-storage/async-storage` → 2.2.0, `@react-native-community/netinfo` → 11.5.2,
    plus expo-camera / expo-router / expo-status-bar / expo-localization / expo-image-manipulator / expo-dev-client bumps.
- `expo install --fix` exited non-zero only because pnpm refused to run `@sentry/cli`'s
  postinstall script (`ERR_PNPM_IGNORED_BUILDS`) — **not a real failure**; deps installed fine.
- **Gate checks after the fix: ALL GREEN** — `typecheck` 0 errors, `lint` 0 warnings, `test` 15 passed.
- `android/gradle/wrapper/gradle-wrapper.properties`: set `validateDistributionUrl=false`
  and `networkTimeout=60000` to stop Gradle-wrapper download/validation timeouts. **Keep these.**
- `android/gradle.properties`: tried `newArchEnabled=false`, then **reverted back to `true`** (unsupported).

### ⏭️ NEXT STEP (blocker done — this is now Phase 5 onboarding)

The build works. To run it on a device/emulator:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
cd "/Users/macj/Documents/Cursor/Gameapp v1"
pnpm android   # or: cd android && ./gradlew installDebug  (with an emulator/device running)
```

Then start the bundler with `pnpm start`. After that, proceed to Phase 5 (section 9).
Note: the `google-services.json` dev-package patch (section 5) may still be needed for Firebase
at runtime — register `com.v1.boardgameapp.dev` in the Firebase console for a permanent fix.

### Minor leftover (non-blocking, JS-only)

A few **devDeps** are still slightly ahead of what expo-doctor wants (`typescript` 6.x vs ~5.9.2,
`@types/jest` 30 vs 29.5.14, `jest-expo` ~55.0.0 vs ~55.0.18). These don't affect the native
build and all gate checks pass — align later if desired.

---

## 1. Phase 4 completion status

| Task                                  | Status     | Notes                                                        |
| ------------------------------------- | ---------- | ------------------------------------------------------------ |
| `eas.json` — 3 build profiles         | ✅ Done    | `development` / `preview` / `production`                     |
| `firebase.json` + `.firebaserc`       | ✅ Done    | Project pinned to `bg-ape`                                   |
| `README.md` updated                   | ✅ Done    | Phases 1–3 complete, test count, caveats                     |
| `docs/ARCHITECTURE.md` updated        | ✅ Done    | Version 1.3, phases 2–3 marked complete                      |
| Firestore rules deployed              | ✅ Done    | `firebase deploy --only firestore:rules` succeeded           |
| 8 placeholder deps installed          | ✅ Done    | All SDK 55 compatible (see section 3)                        |
| `@shopify/flash-list` swap            | ✅ Done    | `FlatList` → `FlashList` in `app/(app)/index.tsx`            |
| Gate checks (typecheck / lint / test) | ✅ Done    | All green, 15 tests passing                                  |
| `pnpm install --frozen-lockfile`      | ✅ Done    | Lockfile clean                                               |
| **Android dev-client build**          | ❌ Blocked | `expo-modules-core:compileDebugKotlin` fails — see section 4 |

**Overall Phase 4 state:** All code and config tasks are complete. The only blocker is the Android native build. The JS codebase is clean and fully gate-checked. Phase 5 can be planned now; the build issue must be resolved before the app can run on a device/emulator.

---

## 2. Gate checks (confirmed green after all Phase 4 changes)

```
pnpm typecheck   ✅  0 errors
pnpm lint        ✅  0 warnings, 0 errors
pnpm test        ✅  15 tests passed (3 suites)
pnpm install --frozen-lockfile  ✅  exit 0
```

---

## 3. All installed dependencies after Phase 4

### New in Phase 4 (`dependencies`)

```
@shopify/flash-list                        ^2.3.1   (chat list — was FlatList, now FlashList v2)
expo-camera                               ~55.0.18  (placeholder — Phase 5 VisionProvider)
expo-image-manipulator                    ~55.0.16  (placeholder — Phase 5 VisionProvider)
expo-image-picker                         ~55.0.20  (placeholder — Phase 5 VisionProvider)
expo-localization                         ~55.0.14  (placeholder — Phase 5 i18n bootstrap)
expo-notifications                        ~55.0.23  (placeholder — Phase 5 push reminders)
react-native-purchases                     10.1.1   (placeholder — Phase 5 RevenueCat)
@react-native-firebase/crashlytics        ^24.0.0   (placeholder — Phase 5 full Crashlytics)
@react-native-firebase/remote-config      ^24.0.0   (placeholder — Phase 5 RemoteFlagProvider)
```

**Important:** All 8 placeholder deps are installed but **not wired up** anywhere in the codebase. They are stubs for Phase 5. No `expo prebuild` is needed just to import their types.

### FlashList v2 API note

`@shopify/flash-list` v2.3.1 dropped `estimatedItemSize` — it no longer exists in `FlashListProps`. The chat screen uses `FlashList` without that prop. Do not add it back.

### expo-localization plugin note

`expo install` warned: _"Cannot automatically write to dynamic config at: app.config.ts — Add expo-localization to plugins."_
This is intentional — `app.config.ts` is a pinned file. The plugin registration is a **Phase 5 task**.

---

## 4. Android build blocker — unresolved

### Symptom

```
FAILURE: Build failed with an exception.
* What went wrong:
Execution failed for task ':expo-modules-core:compileDebugKotlin'.
> A failure occurred while executing ...GradleKotlinCompilerWorkAction
   > Compilation error. See log for more details
```

### Root cause

Unknown — the actual Kotlin error lines (`e:` prefixed) could not be captured. The Gradle `--info` output did not produce visible terminal output during debugging, possibly due to buffering or terminal encoding. The exact error message has not been seen.

### Fixes applied to `android/` during debugging (all are safe to keep)

**`android/gradle/wrapper/gradle-wrapper.properties`**

- Downgraded from `gradle-9.0.0` (generated by prebuild) → `gradle-8.13` (minimum required by the installed AGP)

**`android/build.gradle`** — `allprojects.repositories` block

- Added local Maven repo for `@react-native-async-storage/async-storage` v3, which ships `storage-android:1.0.0` as a bundled AAR rather than publishing to Maven Central:

```groovy
maven {
  url "$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo"
}
```

**`android/gradle.properties`**

- Increased heap: `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m`
- Added: `kotlin.jvm.target.validation.mode=warning` (suppresses JVM target mismatch errors from third-party modules under Gradle 8.13)

**`android/app/google-services.json`** (generated file — patched post-prebuild)

- Added client entry for `com.v1.boardgameapp.dev` (the dev package name from `app.config.ts`) — the Firebase project only has `com.v1.boardgameapp` registered
- **This patch is lost on every `expo prebuild` run.** See permanent fix in section 5.

**`assets/` directory** (was empty, blocking prebuild)

- Created placeholder PNGs: `icon.png` (1024×1024), `adaptive-icon.png` (1024×1024), `splash.png` (1284×2778)
- Solid dark colours matching the app theme. Replace with real branded assets in Phase 5.

### Untried fixes to attempt next (in order)

**Option A — Disable New Architecture temporarily (highest chance of success)**

In `android/gradle.properties`, change:

```
newArchEnabled=true
```

to:

```
newArchEnabled=false
```

New Architecture (Fabric + TurboModules) is the most common source of `expo-modules-core` Kotlin errors with bleeding-edge Gradle/AGP versions. Disabling it gets the dev-client running now; it can be re-enabled in Phase 5 once the root cause is understood.

**Option B — Pin Kotlin version explicitly**

Add to `android/gradle.properties`:

```
kotlinVersion=2.0.21
```

Then in `android/build.gradle` `buildscript.dependencies`:

```groovy
classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21")
```

Expo SDK 55 uses Kotlin 2.0.x. If the Gradle toolchain resolves a different version this can cause binary incompatibility with `expo-modules-core`'s pre-compiled bytecode.

**Option C — Capture the actual error**

The actual Kotlin error lines have not been seen. Run this from a terminal where `JAVA_HOME` and `ANDROID_HOME` are set:

```bash
cd "/Users/macj/Documents/Cursor/Gameapp v1/android"
./gradlew :expo-modules-core:compileDebugKotlin --rerun-tasks 2>&1 > /tmp/build-log.txt
grep "^e:" /tmp/build-log.txt | head -30
```

Redirect to a file to avoid buffering issues. Share the `grep` output.

---

## 5. Permanent fixes required before next `expo prebuild`

Every time `expo prebuild --platform android` is run, it regenerates the `android/` directory. The following manual patches must be reapplied each time — until the permanent fixes are done:

| Patch                                                               | Permanent fix                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add `com.v1.boardgameapp.dev` to `android/app/google-services.json` | Register `com.v1.boardgameapp.dev` as an Android app in Firebase console (Project Settings → Add app → Android). Download the updated `google-services.json`, replace the project root copy. Then prebuild generates the correct file automatically. |
| Downgrade `gradle-wrapper.properties` from `9.0.0` to `8.13`        | None needed — this is a prebuild bug. Reapply after every prebuild.                                                                                                                                                                                  |
| Add `local_repo` maven URL to `android/build.gradle`                | None needed until `@react-native-async-storage/async-storage` v3 fixes its own Gradle plugin to register the local repo automatically. Reapply after every prebuild.                                                                                 |
| `kotlin.jvm.target.validation.mode=warning` in `gradle.properties`  | Reapply after every prebuild.                                                                                                                                                                                                                        |

---

## 6. Environment setup (required every terminal session until ~/.zshrc is updated)

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$HOME/.local/bin:$PATH"
```

**Permanent (run once):**

```bash
cat >> ~/.zshrc << 'EOF'

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$HOME/.local/bin:$PATH"
EOF
source ~/.zshrc
```

**Firebase CLI** — already installed. Project is pinned (`bg-ape`). No re-auth needed unless token expires.

---

## 7. New files created in Phase 4

```
eas.json                     — EAS build profiles (development / preview / production)
firebase.json                — Firebase CLI project config (firestore rules + functions source)
.firebaserc                  — Pins default project to bg-ape
assets/icon.png              — Placeholder 1024×1024 dark PNG (replace with real icon in Phase 5)
assets/adaptive-icon.png     — Placeholder 1024×1024 dark PNG (foreground layer for adaptive icon)
assets/splash.png            — Placeholder 1284×2778 dark PNG (replace with real splash in Phase 5)
```

---

## 8. Modified files in Phase 4

```
app/(app)/index.tsx          — FlatList → FlashList (no estimatedItemSize in v2)
android/gradle/wrapper/
  gradle-wrapper.properties  — gradle-9.0.0 → gradle-8.13
android/build.gradle         — added async-storage local_repo maven URL
android/gradle.properties    — heap 4096m, kotlin.jvm.target.validation.mode=warning
android/app/
  google-services.json       — added com.v1.boardgameapp.dev client entry (re-patch after prebuild)
docs/ARCHITECTURE.md         — version 1.3, phases 1–3 complete
docs/version4-inprogress.md  — this file
README.md                    — phases 1–3 complete, test count, EAS section, caveats
```

---

## 9. What Phase 5 must build

> Start Phase 5 only after the Android build is unblocked (section 4 options A–C above).

### 9.1 Register dev Firebase app (prerequisite, not Phase 5 feature work)

Firebase console → Project Settings → Add app → Android → package name `com.v1.boardgameapp.dev`.
Download updated `google-services.json`, replace project root copy, re-run `expo prebuild`.

### 9.2 Google Sign-In (Credential Manager)

- Install `@react-native-google-signin/google-signin` (stop-and-ask gate — native module)
- Implement `GoogleSignInAuthProvider` behind the existing `AuthProvider` interface
- Wire into login screen behind `featureFlags.auth.useGoogleSignIn`
- No login screen layout changes — the interface swap is transparent to the UI

### 9.3 Crashlytics full integration

`@react-native-firebase/crashlytics` is already installed (placeholder). Tasks:

- Add `@react-native-firebase/crashlytics` to `app.config.ts` plugins (stop-and-ask gate)
- Wire `SentryLogger.captureException()` to also call `crashlytics().recordError()`
- Test that crashes appear in Firebase console

### 9.4 Remote Config

`@react-native-firebase/remote-config` is already installed (placeholder). Tasks:

- Implement `RemoteFlagProvider` in `src/modules/remoteConfig/FirebaseRemoteFlagProvider.ts`
- Layer it on top of `featureFlags.ts` local defaults
- Add `@react-native-firebase/remote-config` to `app.config.ts` plugins (stop-and-ask gate)

### 9.5 VertexAI assistant (real LLM)

- Implement `VertexAIInFirebaseAssistantProvider` (stub already exists at `src/modules/assistant/VertexAIInFirebaseAssistantProvider.ts`)
- Implement `assistantPing` Cloud Function in `functions/src/assistant/assistantPing.ts` (stub exists)
- Flip `featureFlags.assistant.useRealProvider = true` gated behind Remote Config

### 9.6 i18n bootstrap

`expo-localization` is already installed (placeholder). Tasks:

- Add `expo-localization` to `app.config.ts` plugins (stop-and-ask gate)
- Install `i18next` + `react-i18next` (non-native, no rebuild needed)
- Wire `copy.ts` strings through i18next — all copy is already centralised, this is a mechanical swap

### 9.7 Branded assets

Replace placeholders with real brand assets:

- `assets/icon.png` — 1024×1024, transparent background
- `assets/adaptive-icon.png` — 1024×1024 foreground layer (safe zone: 66% = 672px centred)
- `assets/splash.png` — 1284×2778 or use `expo-splash-screen` with a programmatic splash

### 9.8 Rate limiting in Cloud Functions

Add rate limiting middleware to `functions/src/assistant/assistantPing.ts` before public launch.
Firebase has no built-in rate limiter — use a Firestore counter with a rolling window or a Redis-backed approach via Cloud Memorystore.

### 9.9 Store listing

- Privacy Policy URL (required by Play Store)
- Data Safety form (Firestore + Analytics disclosure)
- Store screenshots (can use emulator screenshots from the working dev client)
- Short and full descriptions

---

## 10. Operator rules (unchanged from v3 — enforce strictly)

1. Work in batches of ~10 files maximum per turn.
2. Run `pnpm typecheck && pnpm lint && pnpm test` after each batch.
3. **Stop and ask before** installing any native module not already in `package.json`.
4. **Stop and ask before** modifying `app.config.ts`, `babel.config.js`, `tsconfig.json`, `metro.config.js`, or `package.json` scripts.
5. **Stop and ask before** any `eas build` run, Firebase console change, or secret generation.
6. No `any` in TypeScript. ESLint enforces `@typescript-eslint/no-explicit-any: error`.
7. No Firebase imports in `app/**` or `src/components/**` — repositories only.
8. No business logic in JSX — screens consume hooks only.
9. No magic strings — copy via `src/constants/copy.ts`, routes via `src/constants/routes.ts`.
10. Every new Firestore document type needs a Zod schema at the repository boundary.
11. `exactOptionalPropertyTypes: true` — never assign `undefined` to an optional key; omit it.
12. `noUncheckedIndexedAccess: true` — all array/object index access returns `T | undefined`.

---

## 11. Reference documents

| Document                 | Path                         |
| ------------------------ | ---------------------------- |
| Full architecture design | `docs/ARCHITECTURE.md`       |
| Phase 3 completion state | `docs/version3-handover.md`  |
| Phases 1–2 background    | `docs/HANDOFF.md`            |
| Firestore rules          | `firestore.rules`            |
| EAS build profiles       | `eas.json`                   |
| Firebase CLI config      | `firebase.json`              |
| Environment variables    | `.env.example`               |
| Design tokens            | `src/theme/tokens.ts`        |
| All user-facing copy     | `src/constants/copy.ts`      |
| Route constants          | `src/constants/routes.ts`    |
| Query key factory        | `src/constants/queryKeys.ts` |
| Feature flags            | `src/config/featureFlags.ts` |
