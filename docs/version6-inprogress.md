# BG Ape — Version 6 (in progress)

Living plan doc for the v6 work stream. Focus: hardening the **LLM-based use cases**
(recommender, quick setup, and rules) and moving BGG metadata onto a
**shared, cached, incrementally-refreshed** model.

Last updated: 2026-10-30

> Related history: `docs/version5-inprogress.md`, `docs/version5-handover.md`.
> The recommender collection-context + conversation-history work is committed
> (`feat(assistant): collection context, conversation history & BGG-aligned recommender`).
> Part A below is committed in `d23cb44`. The 2026-10-30 picker, reply-button,
> shared-profile, and unified game-chat work is in the working tree and not committed yet.

---

## Current status (2026-10-30)

### Done and committed (`d23cb44`, not yet pushed)

Part A is in the app: `gameContext` and `setupDepth` on the assistant request, the
chosen game bound onto the thread, player-count chips (reused from a recent
recommendation when present), expansions filtered out of the setup/rules pickers,
depth-aware setup prompts, and Quick setup / Rules help on the game screen.
Also in that commit: tabs shell, Gemini 3.5 Flash, collection filters, and plays polish.

### Done in the working tree (not committed)

**Game picker filters.** The long category/mechanic chip list is replaced by six
choices plus a search field for the rest of the BoardGameGeek tags.

- Cooperative / competitive — one or the other.
- Euro / ameritrash — one or the other. Euro means economic systems, point salad,
  resources, low interaction, and luck mitigation. Ameritrash means minis, fighting,
  dice, and high luck.
- Story-driven (yes / no), area control, economic, and cool minis can combine.

**Reply buttons.** A recommendation stores up to four `suggestedGames`. Tapping one
hides the other game buttons and shows quick rules overview, game setup, more about
the game, and compare. Tap the selected name to bring the list back.

- **I want more games** sends every title already suggested in the thread and drops
  any repeat before the buttons are shown.
- **Compare** asks for the same number of new peers as the latest suggestion set
  (four suggestions → “Compare with 4 similar games”).
- Game setup opens Quick setup with that game and the player count filled in, and
  still asks for depth. Rules follow-ups open Rules helper. A stored FAQ question
  opens a rules chat with the saved answer and does not call the model again.

**While a reply is generated.** The chat shows a thinking indicator, then the
finished answer. The old letter-by-letter replay was local and was not an extra
model call. A prompt queued from the intent screen is sent once, and a copy of the
same prompt stored back-to-back is hidden.

**Shared game profile (first slice of Part B).** `ensureBggGameProfile` writes
`bggGames/{bggId}`: tags and other BoardGameGeek metadata, plus up to five rules
questions and validated answers. Forum thread titles are clues only and are not
stored. Signed-in users can read the collection; only the Cloud Function writes it.
Not deployed yet. Before the FAQ works on a device:

```bash
firebase functions:secrets:set BGG_API_TOKEN
firebase deploy --only functions,firestore:rules
```

The “do not repeat the user’s prompt” line in the system prompt also needs that
functions deploy. The exclusion list and the compare count are already in the
message text, so they work against the currently deployed function.

**One chat per parent game.** A player has a single thread for a game, keyed by
`gameKey` (`game:{collectionId}` of the base game, or `name:{lowercase}` when the
name is typed and not in the collection). New game chats use reason `general` and
the parent name as the title. An expansion such as Dominion Prosperity is stored
on Dominion. An older setup or rules thread for the base game or one of its
expansions is adopted the next time that game is opened.

Sub-discussions are fields on the messages, not extra threads: `discussionId`,
`discussionTitle`, `discussionKind` (`setup` | `rules`), `versionName`,
`playerCount`. The model only sees that discussion’s history. Setup and rules for
different editions stack as containers, for example
“Dominion: Prosperity: Quick setup (for 4 players)”.

- The opening exchange stays open. The next topic button collapses it. The card
  title comes from the depth: “5 minute setup”, “15 minute setup”, or
  “Full rules walkthrough”. Later topics use the button name (Basic rules,
  Scoring, and the rest). Elaborate stays inside the open topic. Mark as solved
  closes it on the phone.
- Collection **Quick setup** and **Rules help** open this chat filtered to that
  kind. With no chat yet, the form runs first and the result is saved on the
  parent game. **Different setup or game version** and **Different rule question**
  open the matching form with the parent name already in the search field.
- A chat opened from game detail is the stack screen `/(app)/game-chat`. The
  phone back button and the ‹ control return to that game. A chat opened from
  the Chat tab still returns to the conversation list.
- Follow-up topic buttons stay in the same chat. A repeated user-plus-answer pair
  is hidden, and the same text is not sent again within 15 seconds.
- Mark as solved also calls `recordGameplayQuestion`, which appends
  `{topic, question, answer}` onto `bggGames/{bggId}.gameplayQuestions` (cap 40).
  That callable is in source and is not deployed, so the phone shows a notice
  and still collapses the topic. `ensureBggGameProfile` must keep
  `gameplayQuestions` when it rewrites the profile; that preservation is in
  source and ships with the same functions deploy.

---

## 0. Confirmed decisions (from planning)

These are locked and reflected throughout the plan below:

1. **Add `gameContext` and `setupDepth`** to the assistant request. ✅
2. **Player count stays as prompt text** for now — no structured request field.
3. **`setupDepth` is detected in `useSendMessage`** (phrase → enum), mirroring
   `detectActivityBias`. Not stored on the thread.
4. **`gameContext` is built only when the game is in the collection.** For BGG-only
   picks or games not in the collection, **fall back to "default / simplest" setup**:
   the model is instructed to give the most common standard setup at a default player
   count, avoiding variants/advanced scenarios, and to state its assumption briefly.
5. **Keep the caching workflow.** Do **not** call BGG live per question. Add a
   **weekly scheduled Cloud Function** for incremental refresh and introduce a
   **shared `bggGames/{bggId}` cache** (dedupe across users).

---

## PART A — Quick setup + Rules LLM improvements

### Background (current state)

- Home → "Quick setup" / "Rules help" → `app/(app)/intent.tsx` → `QuickSetupFilters` /
  `RulesFilters` → builds a text prompt → Gemini (`assistantCall`).
- **Problem:** the selected game is only ever passed as a _word in the prompt text_.
  Structured facts about it are dropped, and `intent.tsx handleStart` creates the
  thread with only `{ title, reason }` — so `GameContextCard` never shows for these
  flows and the LLM has no game metadata.
- `Conversation.tsx` already resolves the context game from `thread.gameId` /
  `thread.gameName`, so **binding the game onto the thread lights up the card and gives
  `useSendMessage` a handle to build `gameContext`** — no separate plumbing needed.

### Shared request-shape changes — DONE (`d23cb44`)

Extend `AssistantRequest` (client type + Zod schema + Cloud Function validator) with:

- `gameContext?: CollectionGameContextItem` — reuse the existing compact shape
  (name, players, time, weight, categories, mechanics). Used by **setup + rules**.
- `setupDepth?: 'quick' | 'basic' | 'full'` — used by **setup** only.

Files: `src/features/assistant/types/index.ts`, `src/features/assistant/schemas/index.ts`,
`functions/src/assistant/assistantCall.ts` (parse/validate + size guard already at 10k
chars), `functions/src/assistant/prompts.ts` (new single-game block + depth-aware setup
context + **default/simplest fallback** wording when no `gameContext`).

---

### Item 1 — Bind `gameId` / `gameName` to the thread — DONE (`d23cb44`)

- **What:** carry the chosen game onto the created thread so the context card shows and
  `useSendMessage` can look it up.
- **Files:** `src/features/chat/components/intent/QuickSetupFilters.tsx`,
  `RulesFilters.tsx` (emit selection up via a new `onContextChange(ctx)` prop),
  `app/(app)/intent.tsx` (`handleStart` includes `gameId`/`gameName` in the
  `NewChatThread` when present).
- **Data model:** none — `NewChatThread` already supports `gameId`/`gameName`
  (used by `NewConversationSheet`) and the repo/schema persist them.
- **Dependencies:** none (foundational UI wiring). **Enables** the context card and Item 2.
- **Effort:** S · **Risk:** low.

### Item 2 — Send `gameContext` to the LLM (with default fallback) — DONE (`d23cb44`)

- **What:** for `setup`/`rules` threads, look up `thread.gameId`/`gameName` in the
  collection cache, build a single-game `gameContext`, and attach it to the request.
  **If the game is not in the collection**, send no `gameContext` and let the prompt's
  **default/simplest-setup fallback** handle it (per decision #4).
- **Files:** `src/features/assistant/lib/collectionContext.ts` (add
  `buildGameContext(game)`), `functions/src/assistant/prompts.ts` (format a single-game
  block; add fallback instruction), `functions/src/assistant/assistantCall.ts`
  (validate/parse `gameContext`), `src/features/chat/services/assistantOrchestrator.ts`
  - `src/features/chat/hooks/useSendMessage.ts` (build + pass `gameContext`).
- **Dependencies:** shared request-shape change; **Item 1** (thread carries the game).
- **Deploy:** requires a functions redeploy.
- **Effort:** M · **Risk:** low-med.

### Item 3 — Player-count input on Quick setup — DONE (`d23cb44`)

- **What:** add player-count chips (like `GamePickerFilters`); append e.g.
  "We'll be 4 players." to the built prompt. **Prompt text only** (decision #2).
- **Files:** `QuickSetupFilters.tsx`, `src/constants/copy.ts`
  (`intent.quickSetup.playersLabel` + prompt part).
- **Dependencies:** copy strings. Independent of Items 1/2.
- **Effort:** S · **Risk:** low.

### Item 4 — Filter expansions out of the pickers — DONE (`d23cb44`)

- **What:** exclude `kind === 'expansion'` from the setup/rules game pickers
  (consistent with play logging).
- **Files:** `QuickSetupFilters.tsx`, `RulesFilters.tsx` (filter before passing to
  `CollectionPicker`; keep `CollectionPicker` generic).
- **Dependencies:** none. Same files as Items 1/3.
- **Effort:** S · **Risk:** low.

### Item 5 — Depth-specific prompt shaping — DONE (`d23cb44`)

- **What:** `buildSystemPrompt` gains a `setupDepth` argument; the setup context becomes
  depth-aware — `quick` = just enough for the first turn; `basic` = core loop;
  `full` = complete walkthrough. Depth is **detected in `useSendMessage`** via a new
  `detectSetupDepth(text)` helper (decision #3).
- **Files:** `functions/src/assistant/prompts.ts`,
  `functions/src/assistant/assistantCall.ts` (thread `setupDepth` into the prompt),
  `src/features/assistant/lib/collectionContext.ts` (or a small new lib) for
  `detectSetupDepth`, `src/features/chat/hooks/useSendMessage.ts`.
- **Dependencies:** shared request-shape change; deploy.
- **Effort:** S-M · **Risk:** low.

### Item 6 — "Quick setup" / "Rules help" buttons on game detail — DONE, then extended

- **What:** contextual entry points on the game screen (the v5 vision's "quick setup
  button on a game"). Committed in `d23cb44` as an intent-form launch with the game
  preselected.
- **2026-10-30 extension (working tree):** the buttons open the one chat for the
  parent game (`app/(app)/game-chat.tsx`), filtered to setup or rules. The intent
  form runs only when that game has no chat yet, or when the player starts another
  version from inside the chat. Back from that screen returns to game detail.
- **Files:** `app/(app)/game.tsx`, `app/(app)/game-chat.tsx`, `app/(app)/intent.tsx`,
  `src/features/chat/lib/gameThread.ts`, `src/features/chat/lib/messageGroups.ts`,
  `src/constants/copy.ts`.

### Dependency graph & suggested order (Part A)

```
Shared request-shape change ── foundational
        ├── Item 2 (gameContext) ─┐  (needs Item 1 for the game handle)
        ├── Item 5 (depth shaping)┤  (both need a functions redeploy)
Item 1 (bind game) ──────────────┴── Item 6 (game-detail entry: onContextChange + preselect)
Item 3 (player chips) ── independent (copy)
Item 4 (expansion filter) ── independent (same files as 1/3)
Copy + tests ── supports 3/6, then gate checks + one deploy
```

Recommended sequence: **(A)** shared request-shape → **(B)** Item 1 → **(C)** Item 2 +
`buildGameContext` + fallback → **(D)** Item 5 depth → **(E)** Items 3 + 4 (filter-file
edits together) → **(F)** Item 6 entries → **(G)** copy finalization, tests,
`typecheck`/`lint`/`test`, then **one functions deploy**.

### Testing (Part A)

- Unit: `buildGameContext` (CollectionGame → compact item, omits play stats),
  `detectSetupDepth` (phrase → enum; default when absent), expansion filtering.
- CF validator: `gameContext` / `setupDepth` accepted; bad values rejected; size guard holds.
- Manual on device: game detail → Quick setup preselected; card shows; answer reflects the
  real player count/components; BGG-only game → sensible **default/simplest** setup.

---

## PART B — BGG metadata: shared cache + weekly incremental refresh

### Rationale

The recommender/setup hot path already reads **stored** metadata (Firestore →
React Query), not live BGG — correct. The remaining inefficiencies are:

- **Per-user duplication:** metadata is stored per `CollectionGame`. The same game owned
  by N users is stored and refreshed N times.
- **Staleness of volatile fields:** `bggRating`, `bggRank`, `averageWeight` drift over
  time; static fields (name, year, players, time, categories, mechanics) never change.

### B1 — Shared `bggGames/{bggId}` cache (canonical snapshot)

- **New collection:** `bggGames/{bggId}` — one doc per game: full BGG snapshot +
  `bggRefreshedAt`. Deduped across all users; also serves **BGG-only picks** in
  setup/rules (cache-on-first-lookup).
- **`CollectionGame` slims to user-specific data** (notes, `kind`, `parentBggId`,
  `addedAt`) + a `bggId` reference; UI and assistant context **join** against the cache.
- **Structure hardening:** store BGG **numeric link ids** for categories/mechanics (not
  just labels) so filter chips / tag matching are stable across label changes.
- **Migration:** backfill `bggGames` from existing `CollectionGame` docs (one-time);
  keep denormalized fields on `CollectionGame` during transition for backward compat.
- **Security rules:** `bggGames` is app-owned reference data — readable by any signed-in
  user, writable only by Cloud Functions (admin).

### B2 — Weekly scheduled incremental refresh (Cloud Function)

- **Trigger:** Cloud Scheduler → Pub/Sub, weekly (monthly is also acceptable).
- **Job:** collect distinct `bggId`s with `bggRefreshedAt` older than 7 days →
  `bggClient.getThings(ids)` in **batches of 20** (existing serial queue + backoff /
  `Retry-After`) → update **only volatile fields** (`bggRating`, `bggRank`,
  `averageWeight`) + `bggRefreshedAt`.
- **Scope:** only games referenced by at least one user (or present in `bggGames`), to
  avoid refreshing the whole BGG catalog.
- **Cost:** a handful of function invocations/week; Firestore storage a few KB/game.
  Requires the Blaze plan (already enabled).
- **Keep** the detail-screen `useBggThing` as an on-demand "refresh now" fallback.

### Dependencies & order (Part B)

```
B1 shared cache (schema + rules + join in UI/assistant + backfill)
        └── B2 scheduled refresh (reads/writes bggGames; needs B1)
```

Part B is **independent of Part A** and can proceed in parallel, but B1's `bggId`
reference + join should land before B2. If Part A ships first, `buildGameContext`
can later switch its source from `CollectionGame` to the `bggGames` join with no API
change (it already emits `CollectionGameContextItem`).

### Trade-offs to accept (Part B)

- Up to a week of staleness on rank/rating/weight — cosmetic for recommendations/setup.
- A bit more infra (scheduler + one cache collection + backfill migration).
- BGG ToS is fine with reasonable server-side caching + rate-limited refresh.

---

## Backlog

- **Dynamic game-picker filters.** Once play time and complexity are set, nudge the
  other filters to match (party games lean short, heavy euros lean long). Not in the
  current filter pass.
- **Shared play stats.** Only one player tracks the play (timer and play log). The
  stats are mirrored to the other players in that play who also use the app, so they
  do not each log the same session.
- **Box photo to open a game.** Photograph the game box to identify the game, prefill
  the chat filters (player count and the other picker filters already in the app
  where the photo can supply them), and open the chat for that specific game.

## Open items / notes

- **Part B still open:** slim `CollectionGame` down to a `bggId` reference and join
  the shared profile in the UI and assistant; store numeric category/mechanic ids;
  weekly refresh of rating, rank, and weight. The FAQ profile above is only the
  first write path into `bggGames`.
- **Deploy:** `BGG_API_TOKEN` secret, then `firebase deploy --only functions,firestore:rules`.
  Until then, common rules questions stay unavailable on device, and Mark as solved
  cannot write `gameplayQuestions` (the topic still collapses on the phone).
- **Commit:** the 2026-10-30 working-tree changes are not committed. `main` is one
  commit ahead of `origin/main` (`d23cb44`).
- **Artifact Registry cleanup policy:** still **TBD** (see `version5-inprogress.md`).
  `firebase functions:artifacts:setpolicy --location europe-west10` when decided.
- **Rate limiting `assistantCall`:** documented pre-launch item; not part of this stream.

---

## Gate checklist (run before every commit)

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint . --max-warnings 0
pnpm test        # jest
```
