# BG Ape — Version 5 (in progress)

Living status doc for the v5 work stream. v4 (native build running on device, chat
persistence, auth, account, collection) is complete; see
`version4-inprogress.md` and `version4-to-v5-handover.md` for that history.

Last updated: 2026-08-27

---

## 1. Product direction (v5 vision)

BG Ape is evolving from "a chat app" into a **board-game companion** where chat is
one supporting tool among many, surfaced contextually throughout the app (e.g. a
"quick setup" button on a game, or "help me pick a game for tonight" on Home).

Target information architecture:

- **Home** — dashboard: welcome, universal chatbot entry, "I want…" action list,
  activity chart, top-played games.
- **Chat** — multiple labelled conversations (by reason + optional game).
- **Collection** — games with BGG-powered lookup, table stats, and detail pages.
- **Account** — profile, gaming nickname, integrations (future).
- **Stats** — activity charts (pushed from Home, not a tab).

---

## 2. What is DONE

### 2.1 Multiple conversations (feature A) — DONE

Chat moved from a single per-user thread to **many labelled conversations**.

- **Storage:** `users/{uid}/threads/{threadId}` with messages at
  `users/{uid}/threads/{threadId}/messages/{messageId}`.
- **Thread attributes:** `title`, `reason` (`recommendation` | `setup` | `rules` |
  `general`), optional `gameId` + `gameName`, `createdAt`, `updatedAt`,
  `lastMessagePreview`.
- **Repository:** `ChatRepository` rewritten — `listThreads`, `createThread`,
  `updateThread`, `deleteThread`, `addMessage`, `getMessages`, `deleteMessage`,
  `clearMessages` (all take `uid`). Both `FirestoreChatRepository` and
  `InMemoryChatRepository` implement it; `activeChatRepository.ts` selects by
  `appConfig.chat.persistMessages`.
- **Hooks:** `useThreads`, `useCreateThread`, `useDeleteThread`, `useUpdateThread`;
  message hooks (`useChatMessages`, `useSendMessage`, `useClearConversation`,
  `useDeleteMessage`) now operate on a passed-in `ChatThread`.
- **UI:** Chat tab is master-detail — `ConversationList` (reason emoji, title, game,
  date, preview) ↔ `Conversation` (messages + composer). `NewConversationSheet`
  picks a reason + optional game from the collection and auto-titles the thread
  (e.g. "Quick setup · Wingspan"). Android hardware back pops the detail view.
- **Rules:** covered by `users/{uid}/{document=**}`. The orphaned top-level
  `chatThreads` rule block was removed and rules were **deployed**.

### 2.2 Home / Stats / Account / Nav (Batch 1) — DONE (typecheck + lint green)

- **Home tab** (`app/(app)/index.tsx`) — now the **default landing screen**:
  welcome header, "Ask BG Ape anything" card (starts a `general` conversation),
  "I want to…" list (recommendation / setup / rules → each creates a labelled
  conversation and navigates to Chat), activity card (bar chart → Stats),
  top-games preview (→ Collection).
- **Navigation:** bottom tabs are 🏠 Home · 💬 Chat · 🎲 Collection · 👤 Account.
  Chat moved from `index.tsx` to `chat.tsx`. `Stats` is a hidden tab route
  (`tabBarItemStyle: { display: 'none' }` — NOT `href: null`, which would strip it
  from expo-router typed routes) reached via `router.push('/(app)/stats')`.
- **Cross-tab chat nav:** `src/store/chatUiStore.ts` (zustand) holds
  `activeThreadId`; Home sets it then navigates to Chat, which reads it.
- **Stats screen** (`app/(app)/stats.tsx`): Plays/Group-size + Day/Week/Month
  toggles and a bar chart. Currently **empty state** (no plays data yet).
- **Chart:** `src/components/BarChart.tsx` — dependency-free (plain Views), so no
  native rebuild is required; fully hot-reloadable.
- **Account:** added **gaming nickname** (`gamingNick`) to profile
  schema/types/repo/form, plus an **Integrations** placeholder section
  (BG Stats, BGG, Messenger, Gmail — "Coming soon").

### 2.3 Plays data model — simplified logging + list (DONE, typecheck + lint green)

Dependency-free play logging (no date-picker or chart libs added).

- **Storage:** `users/{uid}/plays/{playId}` (covered by the `users/{uid}/{document=**}`
  rule — no rules change needed).
- **Play fields:** `gameName` (+ optional `gameId` when picked from the
  collection), `playedAt`, and optional `location`, `playerCount`,
  `durationMinutes`, `note`. Only game + date are required.
- **Repository:** `PlaysRepository` (`list`, `add`, `update`, `remove`) with
  `FirestorePlaysRepository` (same `compact()` / raw-type normalization pattern as
  the collection/chat repos). `PlayId` brand added to `src/types`.
- **Hooks:** `usePlays`, `useLogPlay`, `useUpdatePlay` (optimistic — used for
  inline note edits), `useDeletePlay`. Query key `plays.list(uid)`.
- **UI:** hidden **Plays** route (`app/(app)/plays.tsx`, reached from Home's
  "+ Log a play" button). `LogPlaySheet` (game picker from collection + free-text,
  Today/Yesterday quick buttons + manual `YYYY-MM-DD`, location, players, duration,
  note). `PlayRow` shows game/date/meta and an **inline-editable note** (saves on
  blur). Long-press a row to delete.

> NOTE: Stats/Home charts and "top played" are **not** wired to plays yet — that's
> the next step (see Batch 2 below). Logging + list only, per request.

### 2.4 Real LLM assistant — Gemini 2.0 Flash via Cloud Function (DONE, typecheck + lint + tests green)

- **Cloud Function** (`functions/src/assistant/assistantCall.ts`): Gen 2 callable,
  `europe-west10`, App Check enforced, authenticated. Calls Gemini 2.0 Flash with
  `responseSchema` JSON mode — guarantees a structured `AssistantResponse` every time.
- **Prompt system** (`functions/src/assistant/prompts.ts`): per-`threadReason` system
  prompts (recommendation / setup / rules / general) + `isFirstMessage` guidance
  (ask 1-2 clarifying questions when context is thin).
- **Provider** (`src/modules/assistant/VertexAIInFirebaseAssistantProvider.ts`):
  implements `AssistantProvider`; calls the function via the `callable` factory.
  Internal Promise cache ensures `stream()` → `complete()` makes only **one** network
  round-trip per turn. `stream()` simulates character-by-character animation from the
  complete response.
- **Provider selector** (`src/modules/assistant/activeAssistantProvider.ts`): mirrors
  `activeChatRepository` pattern. `featureFlags.assistant.useRealProvider = true`
  (was `false`). `MockAssistantProvider` remains as a fallback.
- **API key setup** (required before first run):
  1. Go to https://aistudio.google.com/app/apikey and create a free API key.
  2. `firebase functions:secrets:set GEMINI_API_KEY` → paste the key.
  3. Deploy: `firebase deploy --only functions`.

### 2.5 BGG whisperer + collection detail (DONE)

BoardGameGeek-powered game lookup and a richer collection.

- **Dependency:** `fast-xml-parser` (pure JS, no native rebuild).
- **BGG client** (`src/services/bgg/`): `bggClient.search(query)`,
  `bggClient.getThing(bggId)`, and `bggClient.getThings(bggIds[])` against the
  public XML API2. Handles 202 (queued) / 429 (rate-limited) with serial request
  queue (1.5 s min gap) + exponential backoff (honours `Retry-After`). Parses
  name/year/players/playing time/thumbnail/image/weight/rating/rank/categories/
  mechanics. Client-side (no Cloud Function). Designed to be reused by the future
  scanner.
- **Developer token:** BGG registration approved; token stored in
  `.env.development.local` (gitignored) as `EXPO_PUBLIC_BGG_TOKEN`. Loaded via
  the validated `src/config/env.ts` schema (optional — falls back to keyless public
  API). Sent as `Authorization: Bearer <token>` on every BGG request.
  See `.env.example` for setup instructions.
- **Hooks:** `useBggSearch` (debounced by caller, cached), `useBggThing`,
  `useUpdateGame` (optimistic — inline notes). Query keys `bgg.search/thing`.
- **Enriched `CollectionGame`:** added `playingTime`, `averageWeight`, `bggRating`,
  `bggRank`, `notes`, `categories`, `mechanics`, plus a `'bgg'` source. Repo
  gained `update()`.
- **Add flow** (`AddGameSheet`): debounced BGG search → pick a result (fetches full
  details and stores them) → added with `source: 'bgg'`; free-text "Add manually"
  fallback (`source: 'manual'`).
- **Richer collection list:** thumbnail + name + year/players, plus a stats line —
  plays count (joined from the plays model by `gameId`), owned-since, BGG rank.
  Row taps through to the detail screen.
- **Game detail screen** (`app/(app)/game.tsx`, hidden route, `?id=` param):
  image, advanced stats (stored values, live-refreshed via `useBggThing` to fill
  gaps), your play count, and an **editable notes** field (saves on blur), plus
  remove.

### 2.6 Enriched plays — players, locations, per-player stats (DONE, typecheck + lint + tests green)

Rich play logging with reusable player and location profiles, per-play participant
tracking, and game metadata denormalisation for future filtering.

- **New branded types:** `PlayerId`, `LocationId` added to `src/types/index.ts`.

- **Player profiles** (`src/features/players/`): stored at
  `users/{uid}/players/{playerId}` with `name`, optional `nickname`, `createdAt`.
  Repository: `list`, `add`, `update`, `remove`. Hooks: `usePlayers`,
  `useCreatePlayer`, `useDeletePlayer`.

- **Location profiles** (`src/features/locations/`): stored at
  `users/{uid}/locations/{locationId}` with `name`, `createdAt`. Same repository
  - hook pattern as players.

- **Extended `Play` document:** new optional fields —
  `participants: PlayParticipant[]` (each: `playerId`, `name` denormalised, `score?`,
  `won`), `locationId`, `locationName` (denormalised), `gameCategories`,
  `gameMechanics`, `gameWeight`. Legacy `location` (string) and `playerCount`
  retained for backward compatibility with older documents.

- **`useLogPlay` smart resolution:**
  - **Find-or-create players**: if a participant name doesn't match an existing
    profile (case-insensitive), a new player profile is created automatically.
  - **Find-or-create locations**: same pattern for locations.
  - **Game metadata denormalisation**: on save, looks up the game in the React
    Query collection cache and copies `categories`, `mechanics`, `averageWeight`
    onto the play document — enables future server-side filtering without joins,
    even if the source `CollectionGame` is later deleted.

- **`LogPlaySheet` redesign:** participant rows (name autocomplete from existing
  profiles, per-player score input, Won toggle), location picker (chip row from
  saved profiles or type-to-create). Backward-compatible: old single player-count
  field still works via `playerCount` on existing documents.

- **`PlayRow` updates:** participant chips with winner highlight (★ gold), optional
  score inline. Each participant name is tappable → navigates to the per-player
  stats screen.

- **Per-player stats screen** (`app/(app)/player.tsx`, hidden route `?id=`):
  summary cards (total plays, wins, win rate, avg score), most played game,
  chronological play history (up to 20 entries).

- **Stats screen filter layer** (`app/(app)/stats.tsx`):
  - Player filter chips (derived from plays' participants — only players who appear
    in at least one play are shown).
  - Location filter chips (same pattern).
  - "Game type" skeleton section — placeholder chips greyed out with a note
    "Available once BGG data is enriched"; will populate automatically once plays
    carry `gameCategories`/`gameMechanics` from BGG-enriched collection games.
  - All summary cards and chart buckets respect the active filters.
  - Players leaderboard at the bottom: each player with plays → total plays + win
    rate → tappable to the per-player stats screen.

---

## 3. What is NOT done yet (roadmap)

### Near-term — collection enrichment

- **Enrich existing manually-added games:** `CollectionGame` documents added before
  the BGG client existed have no `categories`, `mechanics`, or `averageWeight`. A
  one-time enrichment pass (triggered by a UI button or background job) could call
  `bggClient.getThings(bggIds)` in batches of 20 and backfill those fields. Once
  enriched, any newly logged play that references the game will automatically carry
  the metadata.
- **Game type filter (Stats screen):** the "Game type" filter section skeleton is
  already in the Stats screen; it will populate automatically once plays carry
  `gameCategories`/`gameMechanics`. No code change required — just needs enriched
  collection data.

### Near-term — BGG user OAuth

- **Import BGG collection via OAuth:** the developer token is the prerequisite for
  registering a BGG OAuth application. Once set up, users can link their BGG account
  and pull their existing rated/owned game list into BG Ape in one tap.

### Batch 3 — integrations (later)

- **Integrations (future / OAuth):** BG Stats + other databases; sync with
  Messenger / WhatsApp / Gmail / Outlook (enables a future **game-night planner**);
  sync with local board-game cafés so the assistant knows what's playable there.

### Also pending from earlier plan

- **Scanner** (premium OCR of board-game boxes via Google Cloud Vision +
  BGG lookup) — feature flag/gating, Cloud Function with server-side key,
  BGG client (shared with the whisperer), image capture + review UI, app.config
  plugin + prebuild.

---

## 4. Running on a physical device over Wi-Fi (no cable)

USB was unreliable (charge-only cable — the Mac never enumerated the phone), so we
use **Android 11+ Wireless debugging**. Device: Samsung Galaxy S24 (SM-S921B),
app id `com.v1.boardgameapp.dev`, URL scheme `bgape`.

Tooling: adb at `~/Library/Android/sdk/platform-tools/adb` (add to PATH).

### One-time pairing

1. Phone: Settings → Developer options → **Wireless debugging** → ON.
2. "Pair device with pairing code" → note the **pairing** `IP:port` + 6-digit code.
3. Mac: `adb pair <IP>:<pairPort> <code>`.

### Each session (connect + run)

Ports **rotate** and the phone drops off on sleep. adb can usually rediscover via
mDNS (`adb mdns services`). Then:

```bash
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"
adb connect <IP>:<connectPort>        # connectPort from Wireless debugging screen / mdns
adb reverse tcp:8081 tcp:8081         # map Metro to device localhost:8081
pnpm start                            # Metro (regenerates expo-router typed routes on boot)
# reload the dev client onto Metro:
adb shell am start -a android.intent.action.VIEW \
  -d "bgape://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

**"Could not connect to localhost:8081"** on the phone almost always means the
`adb reverse` mapping is missing (e.g. after a Metro restart or reconnect) — just
re-run `adb reverse tcp:8081 tcp:8081` and reload.

---

## 5. Gotchas / notes

- **expo-router typed routes** are generated on Metro boot / bundling into
  `.expo/types/router.d.ts`. In this sandbox the file watcher does NOT emit, so new
  route files may not appear in the types until Metro is restarted. If `tsc` fails
  with "route not assignable", restart Metro.
- **`href: null`** hides a tab from the bar but also **removes it from typed
  routes** — use `tabBarItemStyle: { display: 'none' }` to keep the route
  navigable and typed.
- **`exactOptionalPropertyTypes` is on.** When building objects with optional
  fields from looser sources (Zod parse, Firestore), use an intermediate "raw"
  type with `field?: T | undefined` (see `toThread` in `FirestoreChatRepository`
  and the collection repo) rather than assigning directly to the strict type.
- **Firestore rejects `undefined`** — repos use a `compact()` helper to drop
  undefined keys before writes.
- **Crashlytics Gradle edits are wiped by `expo prebuild`** — re-add
  `firebase-crashlytics-gradle` classpath (`android/build.gradle`) and
  `apply plugin: 'com.google.firebase.crashlytics'` (`android/app/build.gradle`).
- **`react-hook-form` is pinned to 7.74.0** (7.76 broke TextInput typing on RN).
- **expo-router typed routes and new hidden routes:** new hidden routes (e.g.
  `app/(app)/player.tsx`) are not in `.expo/types/router.d.ts` until Metro
  restarts. Until then, navigate using
  `router.push({ pathname: Routes.player, ... } as unknown as Href)`.
- **`.env.development.local`** is gitignored (covered by `.env*.local` pattern in
  `.gitignore`). Store machine-local secrets there — never in `.env.development`
  which is committed.

---

## 6. Gate checklist (run before every commit)

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint . --max-warnings 0
pnpm test        # jest
```

All green as of this update (tests: 15 passing).
