# BG Ape — Version 5 Handover

Consolidated snapshot of the v5 work stream. Supersedes `version5-inprogress.md`.

Last updated: 2026-08-19

---

## 1. Product direction

BG Ape is evolving from "a chat app" into a **board-game companion** where chat is
one supporting tool among many, surfaced contextually throughout the app.

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

### 2.2 Home / Stats / Account / Nav

- **Home** (`app/(app)/index.tsx`): welcome, AskBar, "I want…" list
  (recommendation/setup/rules → intent screen → chat), activity card (→ Stats),
  "+ Log a play" (→ Plays), top-games preview (→ Collection). Real play data wired.
- **Stats** (`app/(app)/stats.tsx`): real play aggregation across Day/Week/Month
  - Plays/Group-size metrics. Summary cards (total plays, this month, avg players,
    most played). Bar chart taps to Stats.
- **Account:** gaming nickname (`gamingNick`) + Integrations placeholder.
- **AskBar** (`src/components/AskBar.tsx`): persistent shortcut at top of every
  main screen; taps to `/(app)/intent?reason=general`.

### 2.3 Plays data model

- Storage `users/{uid}/plays/{playId}`.
- Fields: `gameName` (+optional `gameId`), `playedAt`, optional `location`,
  `playerCount`, `durationMinutes`, `note`. Game + date required.
- `PlaysRepository` + Firestore impl; Hooks: `usePlays`, `useLogPlay`,
  `useUpdatePlay` (optimistic), `useDeletePlay`.
- UI: `LogPlaySheet` (game picker from collection + free-text; Today/Yesterday +
  manual date; location, players, duration, note). `PlayRow` with inline-editable
  note (saves on blur); long-press to delete.

### 2.4 BGG integration

- **Dependency:** `fast-xml-parser` (pure JS, no native rebuild).
- **BGG client** (`src/services/bgg/BggClient.ts`):
  - `search(query)`, `getThing(bggId)`, `getThings(bggIds[])` (batch, max 20).
  - **Rate-limiting:** single serial promise queue, 1.5 s min gap between calls;
    exponential backoff (2 s base, doubles per attempt) + `Retry-After` header.
  - **Auth header:** `Authorization: Bearer <token>` — see §6 below.
  - Parses: name/year/players/time/thumbnail/image/weight/rating/rank +
    **categories** + **mechanics** (from `<link>` nodes).
- **Enriched `CollectionGame`:** all BGG fields stored on add including
  `categories[]` and `mechanics[]`.
- **Add flow** (`AddGameSheet`): debounced search → pick → full details fetched
  and stored (`source: 'bgg'`); free-text fallback.
- **Collection list** (`app/(app)/collection.tsx`): thumbnail + year/players +
  stats. **BGG badge row** (⚖ weight colour-coded, ★ rating, top mechanic chip)
  for `source: 'bgg'` games.
- **Game detail** (`app/(app)/game.tsx`): image, stats grid, **Categories &
  Mechanics chips** (indigo = category, green = mechanic), editable notes,
  **Play history** (chronological list: date · players · duration · location ·
  italic note).
- **`BggGameInput`** component: live autocomplete dropdown used in intent filter
  panels (QuickSetup, RulesHelper).

### 2.5 Intent screens + chat intelligence

- **Intent screen** (`app/(app)/intent.tsx`): "I want to…" hub rendering
  `GamePickerFilters`, `QuickSetupFilters`, or `RulesFilters` based on `reason`
  param. Builds a prompt preview (editable), creates thread, auto-sends first
  message via `chatUiStore.pendingMessage`.
- **Filter components** (`src/features/chat/components/intent/`):
  - `GamePickerFilters`: fromCollection toggle, players chips, complexity, play
    time, category/mechanics multi-select, table-size chips, freetext notes.
  - `QuickSetupFilters` + `RulesFilters`: fromCollection toggle + `CollectionPicker`
    or `BggGameInput`, depth/topic chips.
- **Clarifying questions** (mock, ready for real LLM):
  - `AssistantRequest` carries `threadReason` + `isFirstMessage`.
  - Game Picker: asks 2 questions **only** when first message has no filter signals
    (players/complexity/time/collection keywords). Pre-filled filters → skip
    straight to recommendations.
  - Quick Setup + Rules Helper: always ask one targeted question on first message.
  - `hasFilterSignals(text)` in `MockAssistantProvider` detects the filter context.
- **GameContextCard** (`src/features/chat/components/GameContextCard.tsx`):
  shown as FlashList header in Conversation when `thread.gameName` is set;
  thumbnail + year + player/time/weight/rating chips + top 2 mechanics, sourced
  from local collection cache (no extra API call).

### 2.6 Shared UI components

| Component          | Location                               | Used by                                      |
| ------------------ | -------------------------------------- | -------------------------------------------- |
| `AskBar`           | `src/components/AskBar.tsx`            | Home, Collection, Stats, Account             |
| `BarChart`         | `src/components/BarChart.tsx`          | Home, Stats                                  |
| `MetaChip`         | `src/components/MetaChip.tsx`          | Collection row, Game detail, GameContextCard |
| `CollectionPicker` | `src/features/chat/components/intent/` | QuickSetup, Rules filters                    |
| `BggGameInput`     | `src/features/chat/components/intent/` | QuickSetup, Rules filters                    |

---

## 3. BGG API key — REQUIRED ACTION ⚠️

BGG added mandatory Bearer token auth to XML API2 in 2025. All requests without
a token return **401**.

### What you need to do

1. Register the app at **https://boardgamegeek.com/applications** (takes 1–2 weeks
   for BGG to approve).
2. Once approved, click **Tokens** next to your application and generate a token.
3. BGG strongly recommends making requests **server-side** (token must not be
   exposed in the mobile bundle).

### Planned architecture (Cloud Function proxy)

```
App → Firebase Cloud Function → BGG API (token in Secret Manager)
```

- `BggClient.ts` will point to the Cloud Function URL instead of `boardgamegeek.com`.
- The XML parsing + domain mapping code stays as-is; only the `fetchXml` base URL
  changes.
- Cloud Function caches responses (e.g. 1 h for `/thing`, 10 min for `/search`).

**Until the token is in place, BGG search/add returns empty results.** Any games
already in Firestore (added before the auth change) continue to work normally.

---

## 4. Roadmap (not yet done)

### Immediate (waiting on BGG token)

- Build Cloud Function proxy + wire `BggClient` to it.
- Store BGG token in Firebase Secret Manager.

### Chat / LLM

- Replace `MockAssistantProvider` with a real LLM (OpenAI / Gemini) behind a
  Cloud Function. The `AssistantRequest` + `threadReason` + `isFirstMessage`
  plumbing is already in place.

### Collection enhancements (backlog)

- **B** ✅ — inline BGG metadata badges on collection cards (done)
- **C** ✅ — category/mechanic enrichment on add (done)
- **D** ✅ — game detail: categories/mechanics chips + play history (done)
- **E** ✅ — chat GameContextCard (done)

### Integrations (future / OAuth)

- BG Stats sync; Messenger / WhatsApp / Gmail / Outlook (game-night planner);
  local board-game café sync.

### Scanner (premium)

- OCR boxes via Google Cloud Vision + BGG lookup (reuse BggClient); premium gating.

### Tech debt

- Fixture-based BGG parser tests (sample XML → asserted domain objects).
- Migrate all React Native Firebase namespaced API calls to modular API
  (currently just WARN, not breaking).

---

## 5. Architecture notes

- **Repository pattern** everywhere: interface + Firestore impl (+in-memory for
  chat), consumed only via hooks.
- **exactOptionalPropertyTypes is on.** Build objects with optional fields from
  looser sources via incremental assignment (see `toThread`, `toGame`, `toPlay`).
- **Firestore rejects `undefined`** — repos use a `compact()` helper before writes.
- **Copy** lives in `src/constants/copy.ts`; **query keys** in
  `src/constants/queryKeys.ts`; **routes** in `src/constants/routes.ts`.
- **Optimistic updates** for inline edits (play note, game note) and message ops.

---

## 6. Running on a physical device over Wi-Fi

Device: Galaxy S24 (SM-S921B), package `com.v1.boardgameapp.dev`, scheme `bgape`.
adb: `~/Library/Android/sdk/platform-tools/adb`.

One-time pairing:

```bash
adb pair <IP>:<pairPort> <code>
```

Each session (ports rotate after sleep):

```bash
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"
adb reverse tcp:8081 tcp:8081
pnpm start -- --clear
adb shell am force-stop com.v1.boardgameapp.dev
adb shell am start -a android.intent.action.VIEW \
  -d "bgape://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

**Metro crashes with exit code 7** (uv_interface_addresses) in the Cursor sandbox
— always start Metro with `required_permissions: ["all"]`.

---

## 7. Gotchas

- **expo-router typed routes** generate into `.expo/types/router.d.ts` on Metro
  boot. New route files may not appear until Metro restarts.
- **`href: null`** hides a tab but strips typed routes — use
  `tabBarItemStyle: { display: 'none' }` instead.
- **`react-hook-form` pinned to 7.74.0** (7.76 broke TextInput typing on RN).
- **Crashlytics Gradle edits are wiped by `expo prebuild`** — re-add the
  `firebase-crashlytics-gradle` classpath after each prebuild.
- **pnpm store:** use `--store-dir /Users/macj/Library/pnpm/store/v11`.

---

## 8. Commits this session (2026-08-19)

| Hash      | Description                                                                  |
| --------- | ---------------------------------------------------------------------------- |
| `b4509af` | feat(chat): context-aware clarifying questions per thread reason             |
| `a414c25` | feat(bgg): throttle client, parse categories/mechanics on add                |
| `e45bbc5` | feat(bgg): inline metadata badges, game detail enrichment, chat context card |
| `c9f250c` | fix(bgg): add User-Agent header + fast-fail on 401/403                       |

## 9. Gate checklist

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint . --max-warnings 0
pnpm test        # jest — 15 passing
```
