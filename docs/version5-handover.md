# BG Ape — Version 5 Handover

Consolidated snapshot of the v5 work stream. Companion to the living log in
`version5-inprogress.md`; supersedes it as the definitive v5 reference.

Last updated: 2026-08-18

---

## 1. Product direction

BG Ape is evolving from "a chat app" into a **board-game companion** where chat is
one supporting tool among many, surfaced contextually throughout the app (e.g. a
"quick setup" button on a game, or "help me pick a game for tonight" on Home).

Information architecture (current):

- **Home** (default tab) — dashboard: welcome, universal chatbot entry,
  "I want…" action list, activity chart, top-games preview, log-a-play entry.
- **Chat** — multiple labelled conversations (by reason + optional game).
- **Collection** — BGG-powered games with stats and per-game detail pages.
- **Account** — profile, gaming nickname, integrations (future).
- **Stats** / **Plays** / **Game detail** — hidden routes pushed from the tabs.

Bottom tabs: 🏠 Home · 💬 Chat · 🎲 Collection · 👤 Account.

---

## 2. Feature status (all DONE unless noted; typecheck + lint + tests green)

### 2.1 Multiple conversations

- Storage `users/{uid}/threads/{threadId}` + `.../messages/{messageId}`.
- Thread attributes: `title`, `reason` (`recommendation` | `setup` | `rules` |
  `general`), optional `gameId` + `gameName`, `createdAt`, `updatedAt`,
  `lastMessagePreview`.
- `ChatRepository` (list/create/update/delete threads + message ops, all take
  `uid`); Firestore + in-memory impls; `activeChatRepository` selects by
  `appConfig.chat.persistMessages`.
- Hooks: `useThreads`, `useCreateThread`, `useDeleteThread`, `useUpdateThread`;
  message hooks operate on a passed-in `ChatThread`.
- UI: Chat tab is master-detail (`ConversationList` ↔ `Conversation`);
  `NewConversationSheet` (reason + optional game, auto-title). Android back pops.
- Rules: covered by `users/{uid}/{document=**}`; orphaned `chatThreads` block
  removed and rules **deployed**.

### 2.2 Home / Stats / Account / Nav (Batch 1)

- **Home** (`app/(app)/index.tsx`, default tab): welcome, "Ask BG Ape anything"
  (starts a `general` chat), "I want…" list (recommendation/setup/rules → create a
  labelled conversation and jump to Chat), activity card (→ Stats), "+ Log a play"
  (→ Plays), top-games preview (→ Collection).
- **Cross-tab chat nav:** `src/store/chatUiStore.ts` holds `activeThreadId`; Home
  sets it then navigates to Chat.
- **Stats** (`app/(app)/stats.tsx`): Plays/Group-size + Day/Week/Month toggles +
  bar chart. **Currently empty state — not yet wired to real data.**
- **Chart:** `src/components/BarChart.tsx` — dependency-free (plain Views).
- **Account:** gaming nickname (`gamingNick`) + Integrations placeholder
  (BG Stats, BGG, Messenger, Gmail — "Coming soon").

### 2.3 Plays data model (simplified logging + list)

- Storage `users/{uid}/plays/{playId}` (covered by existing user rule).
- Fields: `gameName` (+ optional `gameId`), `playedAt`, optional `location`,
  `playerCount`, `durationMinutes`, `note`. Game + date required.
- `PlaysRepository` (`list/add/update/remove`) + Firestore impl; `PlayId` brand.
- Hooks: `usePlays`, `useLogPlay`, `useUpdatePlay` (optimistic), `useDeletePlay`.
- UI: hidden **Plays** route from Home. `LogPlaySheet` (game picker from
  collection + free-text; Today/Yesterday + manual `YYYY-MM-DD`; location, players,
  duration, note). `PlayRow` with **inline-editable note** (saves on blur);
  long-press to delete.

### 2.4 BGG whisperer + collection detail

- **Dependency:** `fast-xml-parser` (pure JS, no native rebuild).
- **BGG client** (`src/services/bgg/`): `bggClient.search(query)` +
  `bggClient.getThing(bggId)` against the public XML API2 (no key); `202`/`429`
  retry+backoff; parses name/year/players/time/thumbnail/image/weight/rating/rank.
  Client-side. Reusable by the future scanner. **Kept behind the client boundary —
  returns domain types only, never leaks parser types.**
- **Hooks:** `useBggSearch` (debounced by caller, cached), `useBggThing`,
  `useUpdateGame` (optimistic notes). Query keys `bgg.search/thing`.
- **Enriched `CollectionGame`:** `playingTime`, `averageWeight`, `bggRating`,
  `bggRank`, `notes`, plus `'bgg'` source; repo gained `update()`.
- **Add flow** (`AddGameSheet`): debounced BGG search → pick result (fetches +
  stores full details, `source: 'bgg'`); free-text "Add manually" fallback.
- **Collection list:** thumbnail + year/players + stats line (plays count joined
  from plays by `gameId`, owned-since, BGG rank); row → detail.
- **Game detail** (`app/(app)/game.tsx`, hidden, `?id=`): image, advanced stats
  grid (stored + live `useBggThing` fallback), your play count, editable notes
  (blur-save), remove.

---

## 3. Roadmap (not done)

### Next up — wire real data

- Aggregate `plays` into the **Home activity card**, **Stats charts**, and
  **top-played ranking** (plays model + collection are ready; collection list
  already uses play counts).

### Chat intelligence

- **Clarifying questions:** each scenario asks 1–3 questions before answering
  (recommendation → players / length / weight). Mock-driven now, real LLM later.

### Integrations (future / OAuth)

- BG Stats + other databases; Messenger / WhatsApp / Gmail / Outlook sync
  (enables a **game-night planner**); local board-game café sync.

### Scanner (premium)

- OCR board-game boxes via Google Cloud Vision (Cloud Function, server-side key) +
  BGG lookup (reuse `bggClient`); premium flag/gating; image capture + review UI;
  app.config plugin + prebuild.

### Hardening / tech-debt

- **Add fixture-based BGG parser tests** (sample XML → asserted domain objects) —
  cheap, guards against BGG shape changes and `fast-xml-parser` upgrades.
- **BGG proxy at scale:** move BGG calls to a Cloud Function (cache + rate-limit +
  return JSON). `bggClient`'s interface stays the same and the client-side XML
  parser could then be dropped from the app entirely.

---

## 4. Architecture notes

- **Repository pattern** everywhere (chat, collection, plays, profile): an
  interface + Firestore impl (+ in-memory for chat), consumed only via hooks.
- **exactOptionalPropertyTypes is on.** Build objects with optional fields from
  looser sources via an intermediate "raw" type (`field?: T | undefined`) +
  incremental assignment (see `toThread`, `toGame`, `toPlay`, `toNewGame`).
- **Firestore rejects `undefined`** — repos use a `compact()` helper before writes.
- **Copy** lives in `src/constants/copy.ts`; **query keys** in
  `src/constants/queryKeys.ts`; **routes** in `src/constants/routes.ts`.
- **Optimistic updates** for inline edits (play note, game note) and message ops.

---

## 5. Running on a physical device over Wi-Fi (no cable)

USB was unreliable (charge-only cable). Use **Android 11+ Wireless debugging**.
Device: Galaxy S24 (SM-S921B), app id `com.v1.boardgameapp.dev`, scheme `bgape`.
adb at `~/Library/Android/sdk/platform-tools/adb`.

One-time pairing:

1. Phone: Settings → Developer options → Wireless debugging → ON.
2. "Pair device with pairing code" → note the pairing `IP:port` + 6-digit code.
3. `adb pair <IP>:<pairPort> <code>`.

Each session (ports rotate; phone drops on sleep — `adb mdns services` rediscovers):

```bash
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"
adb connect <IP>:<connectPort>
adb reverse tcp:8081 tcp:8081
pnpm start
adb shell am start -a android.intent.action.VIEW \
  -d "bgape://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

**"Could not connect to localhost:8081"** ⇒ the `adb reverse` mapping is missing
(common after a Metro restart) — re-run `adb reverse tcp:8081 tcp:8081` and reload.

---

## 6. Gotchas

- **expo-router typed routes** generate into `.expo/types/router.d.ts` on Metro
  boot/bundling. This sandbox's file watcher doesn't emit, so new route files may
  not appear until Metro is restarted → if `tsc` says "route not assignable",
  restart Metro.
- **`href: null`** hides a tab from the bar but strips it from typed routes — use
  `tabBarItemStyle: { display: 'none' }` instead (see Stats/Plays/Game routes).
- **`react-hook-form` pinned to 7.74.0** (7.76 broke TextInput typing on RN).
- **Crashlytics Gradle edits are wiped by `expo prebuild`** — re-add the
  `firebase-crashlytics-gradle` classpath (`android/build.gradle`) and
  `apply plugin: 'com.google.firebase.crashlytics'` (`android/app/build.gradle`).
- **pnpm store:** installs must use the global store
  (`--store-dir /Users/macj/Library/pnpm/store/v11`) to match the current
  `node_modules`; the project-local `.pnpm-store` is git-ignored and should not be
  used (it caused the earlier repo bloat).

---

## 7. Git status

- All v5 work (multiple conversations, collection, Batch 1, plays, BGG whisperer)
  is **uncommitted** on top of `7a4a7de "Add full BG Ape app source: Phases 1-4
complete"`. A commit checkpoint is recommended.
- Remote: `bg-ape-dev` (GitHub), SSH via `~/.ssh/id_ed25519_github` (passphrase-less
  key added because the original passphrase was unknown).

---

## 8. Gate checklist (run before every commit)

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint . --max-warnings 0
pnpm test        # jest — 15 passing
```
