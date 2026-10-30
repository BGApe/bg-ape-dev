# Chat layers, rules home, and search ranking

Notes from 30 Oct 2026. Not committed unless asked.

## Chat layout

One chat per parent game. The solid bar is the only full collapse, and it starts closed. Example: “Dominion: Quick setup (for 2 players)”.

Opening that bar shows each topic as a light card: title plus the first couple of sentences. A tap opens the full answer.

Buttons follow the open card.

- Everything closed: Start tracking the play, Popular strategies, Move to rules helper.
- A setup card open (such as the 5 minute setup): those, plus More details on setup, which then offers 15 minute setup and Full rules walkthrough.
- Popular strategies open: More detail on each of the three strategies, Start tracking the play, Move to rules helper.

Start tracking the play is still a placeholder for the timer.

## Strategy follow-ups

A strategy answer sits under the Popular strategies card, shifted right so it reads as part of that topic. Further strategies stay under the same card.

Asking for Popular strategies again does not write a second copy. If that answer is already in the chat, it opens. If it is only on the shared game profile, that saved text is inserted. The chat then asks whether to go into more detail or look for a different set. A different set is a new answer under the same card, and it leaves the stored three strategies in place.

The stored strategies are written by `ensureBggGameProfile` onto `bggGames/{bggId}.winningStrategies`. Until that function is deployed, the first request still asks the assistant, and a later tap in the same chat reuses that answer.

## Rules help

Rules help uses the same game ribbon as quick setup. Under it, player count and version or expansion can be changed. Player chips follow the selected version.

Buttons: Setup, Core mechanics, Pay attention to, FAQ.

FAQ lists questions saved on the shared profile. Each row shows the question and the start of the answer, and opens the full answer on tap.

Opening Rules help from a game goes straight into that chat. Move to rules helper from a quick setup keeps the version and player count already in use.

Rules answers still name an expansion when a card or score exists only there.

## Search ranking

The BoardGameGeek search (add-game sheet and the game name field) still uses one search call. Ordering does not call BoardGameGeek again.

Hits are sorted from data already stored on `bggGames/{bggId}` and on collection games:

- number of BGG ratings (`usersRated`)
- BGG rank (lower first)
- BGG score

Names that are promos, alternate art, or token packs stay at the bottom even when those numbers are missing, so a search for a popular game is not led by obscure promo packs.

`usersRated` is stored the next time a shared profile is built. Rank and score already on a profile or in the collection are used immediately. A functions deploy is required before newly built profiles start saving the rating count.

## Backlog

- **Shared play stats.** Only one player tracks the play (timer and play log). The stats are mirrored to the other players in that play who also use the app, so they do not each log the same session.
- **Box photo to open a game.** Photograph the game box to identify the game, prefill the chat filters (player count and the other picker filters already in the app where the photo can supply them), and open the chat for that specific game.
