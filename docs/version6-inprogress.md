# BG Ape — Version 6 (in progress)

Living plan doc for the v6 work stream. Focus: hardening the **LLM-based use cases**
(recommender ✅ done; **quick setup** + **rules** next) and moving BGG metadata onto a
**shared, cached, incrementally-refreshed** model.

Last updated: 2026-09-14

> Related history: `docs/version5-inprogress.md`, `docs/version5-handover.md`.
> The recommender collection-context + conversation-history work is already committed
> (`feat(assistant): collection context, conversation history & BGG-aligned recommender`).

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

### Shared request-shape changes (do first — foundational)

Extend `AssistantRequest` (client type + Zod schema + Cloud Function validator) with:

- `gameContext?: CollectionGameContextItem` — reuse the existing compact shape
  (name, players, time, weight, categories, mechanics). Used by **setup + rules**.
- `setupDepth?: 'quick' | 'basic' | 'full'` — used by **setup** only.

Files: `src/features/assistant/types/index.ts`, `src/features/assistant/schemas/index.ts`,
`functions/src/assistant/assistantCall.ts` (parse/validate + size guard already at 10k
chars), `functions/src/assistant/prompts.ts` (new single-game block + depth-aware setup
context + **default/simplest fallback** wording when no `gameContext`).

---

### Item 1 — Bind `gameId` / `gameName` to the thread

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

### Item 2 — Send `gameContext` to the LLM (with default fallback)

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

### Item 3 — Player-count input on Quick setup

- **What:** add player-count chips (like `GamePickerFilters`); append e.g.
  "We'll be 4 players." to the built prompt. **Prompt text only** (decision #2).
- **Files:** `QuickSetupFilters.tsx`, `src/constants/copy.ts`
  (`intent.quickSetup.playersLabel` + prompt part).
- **Dependencies:** copy strings. Independent of Items 1/2.
- **Effort:** S · **Risk:** low.

### Item 4 — Filter expansions out of the pickers

- **What:** exclude `kind === 'expansion'` from the setup/rules game pickers
  (consistent with play logging).
- **Files:** `QuickSetupFilters.tsx`, `RulesFilters.tsx` (filter before passing to
  `CollectionPicker`; keep `CollectionPicker` generic).
- **Dependencies:** none. Same files as Items 1/3.
- **Effort:** S · **Risk:** low.

### Item 5 — Depth-specific prompt shaping

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

### Item 6 — "Quick setup" / "Rules help" buttons on game detail

- **What:** contextual entry points on the game screen that open the intent flow with
  the current game preselected (the v5 vision's "quick setup button on a game").
- **Files:** `app/(app)/game.tsx` (two buttons), `app/(app)/intent.tsx` (read a
  `gameId` param → preselect in the filter with `fromCollection` on),
  `src/constants/copy.ts` (button labels).
- **Mechanism:** `router.push({ pathname: Routes.intent, params: { reason: 'setup', gameId } })`.
  Extra query param does **not** affect typed routes (not part of the path).
- **Dependencies:** **Item 1** (the `onContextChange` contract + preselect path);
  benefits from Item 4 (base-game filter).
- **Effort:** S-M · **Risk:** low-med (preselect state sync).

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

## Open items / notes

- **Build caveat (carried from v5):** the committed recommender code references
  `CollectionGame.kind`, which currently lives only in the still-uncommitted collection
  work. A clean build requires that related collection change to be committed too.
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
