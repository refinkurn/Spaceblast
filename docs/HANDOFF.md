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
2. **Upload the game**, about 15 min: `spaceblast-portal.zip` (from `npm run build:portal`, or the "spaceblast-portal" file on the latest GitHub Test run), orientation landscape, desktop + mobile; listing text, covers and both videos are in `docs/LISTING.md` and `listing/`. Then try it in their preview tool on a phone and a computer.
3. **Analytics source column**, 1 min: run the one line in docs/ANALYTICS.md ("Source column") in the Cloudflare D1 console, before the upload.
4. **Traffic analytics token**, 5 min (optional): set `VITE_CF_BEACON_TOKEN` in Vercel (docs/ANALYTICS.md, part 1).
5. **Phone check**, 1 min: the last open line in docs/PHONE_TEST.md (floating stick at rest).
6. **Decisions made for you**: docs/DECISIONS.md. D-1 (quick start on the portal) can be vetoed until 2026-11-16.

## Ready

- **CrazyGames midgame ads, switched off** (src/services/crazygames.ts, src/config/portal.ts, src/flow/story_mode.ts or story_results.ts, src/flow/battle_flow.ts, src/flow/online.ts)
  Now: no ad code; the SDK wrapper has gameplay and invites only.
  Want: `CRAZY_ADS` switch (false) and `midgameAd()` / `adsAvailable()` in the wrapper, sound muted and taps ignored while an ad plays; a midgame ad on the Story "Next level" / "Retry" tap, on leaving the Battle vs Bot end screen, and on leaving an online room (never between online rounds).
  Done when: tests cover the wrapper (switch off = resolves at once, no SDK, adError, no callback within 5 s, adFinished, sound restored) and the three call points; with the switch off the portal build plays exactly as today; `npm test`, `npm run build` and `npm run build:portal` pass.
  Spec: docs/design/crazygames-full-launch.md (Ads)

- **CrazyGames username as the leaderboard name** (src/services/crazygames.ts, src/services/profile.ts, src/flow/leaderboard_screen.ts)
  Now: the leaderboard name is the device profile name ("Bosco_482" or what the player typed), also in the portal build.
  Want: in the portal build, a logged-in CrazyGames user's username (cleaned to our name rules, device name if it can't be used) is the name sent with scores; the leaderboard name field shows it read-only with a short hint (text through t()); logged out = today's behaviour.
  Done when: tests cover a usable username, one with a dot, an unusable one, logged out, no SDK, and a login during play; `npm test` and `npm run build:portal` pass.
  Spec: docs/design/crazygames-full-launch.md (Username)

- **Story progress saved to the CrazyGames account** (src/services/crazygames.ts, src/flow/progress.ts)
  Now: Story progress lives only in localStorage (`spaceblast.story`), so it stays on one device.
  Want: in the portal build with the SDK ready, progress is written to `SDK.data` too; after init the account copy is sanitized and merged with the local one (best of each field), saved to both, and the Story map refreshes if open.
  Done when: tests cover the merge (further on the account, further locally, seen lists joined, bad account data ignored) and no SDK = localStorage only as today; `npm test` and `npm run build:portal` pass.
  Spec: docs/design/crazygames-full-launch.md (Progress)

## In progress

## Blocked

- **Later (postponed by Refindo until the product is ready, no cost now): Capacitor app packaging** - landscape lock, native haptics (@capacitor/haptics: light impact on Charge / power-up, warning on damage). The web build already buzzes via navigator.vibrate on Android.

- **Rewarded extra heart vs score (asked 2026-11-15)**: the roadmap's rewarded ad gives one extra heart on a Story retry. Should that heart count for score and stars? Today hearts left count up to 3 (1000 each) and 3 stars need all 3 hearts, so a bonus heart lets a player lose one and still score full hearts and 3 stars. Suggest: no, score and stars count hearts as if the bonus heart were not there, so the leaderboard stays fair. The item (src/sim option + Story game-over button, code session) is queued once you answer.

## Known issues

Open bugs and debts, newest first. The Producer turns these into Ready items when the milestone allows; fixed ones move to Done.

- **Debt: files over the ~300-line rule**: src/flow/online.ts (500), src/main.ts (338), src/flow/story_map.ts (336). Split by feature, no behaviour change.
- **Frame rate under 50 fps in `npm run perf`** (4 GB Chromebook, a CrazyGames requirement, docs/PORTAL.md): Story level 1 2.3 fps avg, Battle vs Bot 2.2 fps, with 4x CPU throttling and software drawing (no GPU in the cloud run), so this says little about a real Chromebook. Needs a run on a real one (Refindo) or a GPU-backed machine before any optimising.


## Done

- 2026-11-15: Split story_mode.ts: level-clear and game-over banners moved to src/flow/story_results.ts (story_mode.ts 290 lines, story_results.ts 93), no behaviour change. Tests, build and shots pass.

- 2026-11-14: CrazyGames invite button + instant join: lobby shows the SDK invite button for its room and hides it on close, leave or round start; a page opened from a CrazyGames invite opens Multiplayer with the code filled in and skips quick start (our `?room=` unchanged). 534 tests, build, shots and online-check pass.

- 2026-11-14: CrazyGames gameplay start/stop: `setGameplay(active)` called every frame from the main loop (round playing and not paused); the SDK hears changes only, state re-sent once when init finishes; our own site makes no call. 531 tests and build pass.

- 2026-11-14: CrazyGames SDK loader: `CRAZY_SDK` switch, `initCrazySdk()` in src/services/crazygames.ts loads the v3 script at boot in the portal build only (no reference in the normal build; build:portal now checks it is there), failures caught and warned once. 528 tests, build, portal build and shots pass.

- 2026-11-14: Chromebook frame-rate check: `npm run perf` (scripts/perf_check.mjs) plays 20 s of Story level 1 and 20 s of Battle vs Bot at 1366x768, CPU 4x throttled, prints avg fps, 1% worst frame and draw calls; numbers in PORTAL.md; low-fps Known issue replaces the untested one. Battle vs Bot has 2 players (you and the bot), not 4.

- 2026-11-14 (Director run, Refindo: "run it now"): quick start for first-time portal players: one tap lands in Story level 1; the opening crawl and prologue play once as a look back before the next level; once per save, never for a room invite, our own site unchanged (D-1, veto by 2026-11-16). Analytics events carry their source (site / crazygames; D-2) with queries for the numbers CrazyGames judges. Independent review found and fixed 4 bugs before the push (invite ignored, repeat on every visit, story lost if interrupted, level running under the splash). Hibernation closed as not needed now (D-3). The stale M0 / portal lock from 2026-11-10 was released: M0 is done apart from the items under Needs Refindo. 522 tests pass.

Older entries: docs/CHANGELOG.md.

- 2026-11-10: src/main.ts split from 720 to 333 lines, no behaviour change (session.ts, game_run.ts, battle_flow.ts, online_play.ts, event_handlers.ts, keyboard_flow.ts, screen_layout.ts, dev_hooks.ts in src/flow). New `npm run online-check` (two browsers, one room, one round). 515 tests, screenshots and the online check pass.

- 2026-11-10: launch prep (Refindo: "execute"). Portal build (`npm run build:portal`, docs/PORTAL.md: CrazyGames rules read from their docs); desktop players no longer see the touch stick and Charge button (they come back on a real touch); privacy page (public/privacy.html, linked from Credits); iPhone sound resumes on the next touch after an interruption; scripts `status`, `check`, `shots`, `live`; GitHub Actions: screenshot checks on every push and a live check after each deploy and daily; new `ui-builder` agent (Sonnet). Cloud environment "spaceblast" lets sessions reach the live game and the CrazyGames docs. Live check: both addresses run the same build.

- 2026-11-09: floating joystick rests in the middle of the left gutter when idle (was '50%' of the half-screen touch zone, i.e. over the arena's edge); clamped 4 px from the screen edge. Checked at 667/844/896 px wide. Phone checks for Ducking v0.3 and the balance passed (Refindo).

- 2026-11-08: online fixes (sim-specialist). Version check on join: the page sends its build (commit SHA) with ?v=; a room seats one version only; a mismatched page reloads once into the invite link, then shows "Everyone should reload". Host `start` ignored mid-round (a straggler that never reports the round over can hold the next round 10 s at most). A `profile` without a usable name keeps the seat's name. server/room.ts split into room.ts (288 lines), round_clock.ts, room_join.ts; build_version.ts derives the build. 512 tests pass. Every push now changes the version: a tab left open across any deploy reloads before it can join new rooms.
