# Handoff

The single queue between story/design (Claude chat, Web-Mobile Game project) and build (Claude Code).
Both sides read this first and update it last. Keep it short: finished items move to Done with one line, then get deleted after a week.

## How it works

- **Chat** writes specs to `docs/story/<topic>.md` or `docs/design/<topic>.md`, then adds a line under Ready.
- **Claude Code** takes the top Ready item, moves it to In progress, builds it, runs the qa-runner agent, commits to `main`, and moves it to Done.
- Anything that needs Refindo's decision goes under Blocked, with the question.

Day-to-day guide: docs/PLAYBOOK.md. Vision and milestones: docs/ROADMAP.md. Rule numbers: docs/GAME_RULES.md. Look and feel: docs/DESIGN.md (the Producer queues from it daily, 00:44 Jakarta). Phone checks waiting for Refindo: docs/PHONE_TEST.md. A nightly run (01:52 Jakarta) takes up to 4 Ready items from the top, one at a time (text, UI, input, assets, tests only).

Designated build session (main code agent): https://claude.ai/code/session_01XC77HfFWyx7am3DE4jJY5f

Agents (in `.claude/agents/`): `script-integrator` (Haiku, story text), `qa-runner` (Haiku, tests and checks), `sim-specialist` (Opus, game rules and online). The main session runs on Sonnet.

Hosting (details in ONLINE.md): game page on Vercel, https://spaceblast.vercel.app (every push builds it; `main` = live). Rooms + leaderboard on Cloudflare, https://spaceblast.refinkurn.workers.dev: Cloudflare Workers Builds deploys every push to `main` too, so a pushed server change goes live within minutes (and restarts any live match). Fly.io server code is in the repo but not deployed (not free).

## Needs Refindo

Only you can do these (accounts, uploads, your own databases). Ranked by what they unblock. Everything else is prepared.

1. **Create the CrazyGames developer account** (developer.crazygames.com), about 10 min. Unblocks the whole soft launch (M1).
2. **Upload the game**, about 15 min: `spaceblast-portal.zip` (from `npm run build:portal`, or the "spaceblast-portal" file on the latest GitHub Test run), orientation landscape, desktop + mobile; listing text and covers are in `docs/LISTING.md` and `listing/`. Then try it in their preview tool on a phone and a computer.
3. **Analytics source column**, 1 min: run the one line in docs/ANALYTICS.md ("Source column") in the Cloudflare D1 console, before the upload.
4. **Traffic analytics token**, 5 min (optional): set `VITE_CF_BEACON_TOKEN` in Vercel (docs/ANALYTICS.md, part 1).
5. **Phone check**, 1 min: the last open line in docs/PHONE_TEST.md (floating stick at rest).
6. **Decisions made for you**: docs/DECISIONS.md. D-1 (quick start on the portal) can be vetoed until 2026-11-16.

## Ready

## In progress

## Blocked

- **Later (postponed by Refindo until the product is ready, no cost now): Capacitor app packaging** - landscape lock, native haptics (@capacitor/haptics: light impact on Charge / power-up, warning on damage). The web build already buzzes via navigator.vibrate on Android.

## Known issues

Open bugs and debts, newest first. The Producer turns these into Ready items when the milestone allows; fixed ones move to Done.

- **Debt: files over the ~300-line rule**: src/flow/online.ts (500), src/flow/story_mode.ts (339), src/main.ts (338), src/flow/story_map.ts (336). Split by feature, no behaviour change.
- **Not yet tested on a 4 GB Chromebook** (a CrazyGames requirement, docs/PORTAL.md): check frame rate with CPU throttling, or on a real one.


## Done

- 2026-11-14 (Director run, Refindo: "run it now"): quick start for first-time portal players: one tap lands in Story level 1; the opening crawl and prologue play once as a look back before the next level; once per save, never for a room invite, our own site unchanged (D-1, veto by 2026-11-16). Analytics events carry their source (site / crazygames; D-2) with queries for the numbers CrazyGames judges. Independent review found and fixed 4 bugs before the push (invite ignored, repeat on every visit, story lost if interrupted, level running under the splash). Hibernation closed as not needed now (D-3). The stale M0 / portal lock from 2026-11-10 was released: M0 is done apart from the items under Needs Refindo. 522 tests pass.

Older entries: docs/CHANGELOG.md.

- 2026-11-10: src/main.ts split from 720 to 333 lines, no behaviour change (session.ts, game_run.ts, battle_flow.ts, online_play.ts, event_handlers.ts, keyboard_flow.ts, screen_layout.ts, dev_hooks.ts in src/flow). New `npm run online-check` (two browsers, one room, one round). 515 tests, screenshots and the online check pass.

- 2026-11-10: launch prep (Refindo: "execute"). Portal build (`npm run build:portal`, docs/PORTAL.md: CrazyGames rules read from their docs); desktop players no longer see the touch stick and Charge button (they come back on a real touch); privacy page (public/privacy.html, linked from Credits); iPhone sound resumes on the next touch after an interruption; scripts `status`, `check`, `shots`, `live`; GitHub Actions: screenshot checks on every push and a live check after each deploy and daily; new `ui-builder` agent (Sonnet). Cloud environment "spaceblast" lets sessions reach the live game and the CrazyGames docs. Live check: both addresses run the same build.

- 2026-11-09: floating joystick rests in the middle of the left gutter when idle (was '50%' of the half-screen touch zone, i.e. over the arena's edge); clamped 4 px from the screen edge. Checked at 667/844/896 px wide. Phone checks for Ducking v0.3 and the balance passed (Refindo).

- 2026-11-08: online fixes (sim-specialist). Version check on join: the page sends its build (commit SHA) with ?v=; a room seats one version only; a mismatched page reloads once into the invite link, then shows "Everyone should reload". Host `start` ignored mid-round (a straggler that never reports the round over can hold the next round 10 s at most). A `profile` without a usable name keeps the seat's name. server/room.ts split into room.ts (288 lines), round_clock.ts, room_join.ts; build_version.ts derives the build. 512 tests pass. Every push now changes the version: a tab left open across any deploy reloads before it can join new rooms.
