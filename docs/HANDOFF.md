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

- **Rewarded ad wrapper, switched off, no button yet** (src/services/crazygames_ads.ts)
  Now: only `midgameAd()` exists; the roadmap's rewarded ad (one extra heart on a Story retry, M2) has no SDK call. Its button and score rule wait on the Blocked question below.
  Want: `rewardedAd(deps): Promise<boolean>` calls `SDK.ad.requestAd('rewarded', ...)`; true only on `adFinished`; false at once when `adsAvailable()` is false (CRAZY_ADS off, no SDK, ad blocker), on `adError`, or when neither adStarted nor adError comes within 5 s; never rejects. While it plays it uses the same `onAdState` hook as midgame (sound muted, taps shielded). No call site.
  Done when: Vitest covers finished = true, error / timeout / ads off / ad blocker = false, and the mute hook on and off once; `npm test` and `npm run build:portal` pass. Re-read docs.crazygames.com/sdk/html5-v3 (ads) first if reachable; their docs win.
  Spec: docs/design/crazygames-full-launch.md (ads section)

- **Split src/flow/online.ts under 300 lines** (src/flow/online.ts)
  Now: 311 lines; `handle(m: ServerMsg)` (the server message switch, lines ~245-306) is the biggest block in `OnlineRoom`.
  Want: move the message handling to a new src/flow/online_messages.ts (like online_lobby.ts / online_join.ts), no behaviour change.
  Done when: online.ts is under 300 lines; `npm test`, `npm run build`, `npm run shots` and `npm run online-check` pass.

## In progress


## Blocked

- **Later (postponed by Refindo until the product is ready, no cost now): Capacitor app packaging** - landscape lock, native haptics (@capacitor/haptics: light impact on Charge / power-up, warning on damage). The web build already buzzes via navigator.vibrate on Android.

- **Rewarded extra heart vs score (asked 2026-11-15)**: the roadmap's rewarded ad gives one extra heart on a Story retry. Should that heart count for score and stars? Today hearts left count up to 3 (1000 each) and 3 stars need all 3 hearts, so a bonus heart lets a player lose one and still score full hearts and 3 stars. Suggest: no, score and stars count hearts as if the bonus heart were not there, so the leaderboard stays fair. The item (src/sim option + Story game-over button, code session) is queued once you answer.

## Known issues

Open bugs and debts, newest first. The Producer turns these into Ready items when the milestone allows; fixed ones move to Done.

- **src/flow/online.ts is 311 lines** (rule: under ~300). Queued 2026-11-21.

- **Frame rate under 50 fps in `npm run perf`** (4 GB Chromebook, a CrazyGames requirement, docs/PORTAL.md): Story level 1 2.3 fps avg, Battle vs Bot 2.2 fps, with 4x CPU throttling and software drawing (no GPU in the cloud run), so this says little about a real Chromebook. Needs a run on a real one (Refindo) or a GPU-backed machine before any optimising.


## Done

- 2026-11-21: Moved the CrazyGames ad code (midgame ads, adblock check, `onAdState`) to src/services/crazygames_ads.ts; crazygames.ts 307 -> 229 lines, no behaviour change. 597 tests, build and build:portal pass.

- 2026-11-18: Split src/main.ts 364 -> 265 lines: CrazyGames boot wiring to src/flow/portal_boot.ts (`installPortalBoot`), the fixed-timestep loop to src/flow/frame_loop.ts (`installFrameLoop`), no behaviour change. 597 tests, build, build:portal, shots and online-check pass.

- 2026-11-17: CrazyGames loading events: new src/services/crazygames_loading.ts (`watchLoading` sends loadingStart when the SDK is ready while loading; `loadingDone` after the start screen is set up in main.ts sends loadingStop; each once, none if loading ended first, no-op without SDK). 597 tests, build and build:portal pass. Not checked: docs.crazygames.com/sdk/game could not be fetched in this run (permission gate), so the call names and order follow the spec only; worth a re-read.

- 2026-11-17: CrazyGames username as the online name: `chooseOnlineName(account, typed)` (flow/online_prefs.ts); logged in = the Multiplayer name field shows the username read-only with hint `online.fromCrazyGames`, rooms are created/joined with it, saved prefs name untouched; follows `onAccountName`. 593 tests, build, build:portal and online-check pass.

- 2026-11-17: Split src/flow/story_map.ts: node card to story_map_card.ts (`StoryMapCard`); story_map.ts 335 -> 292 lines, no behaviour change. Tests, build and shots pass.

- 2026-11-16: CrazyGames muteAudio setting: `onMuteAudio` (services/crazygames_room.ts) reads `game.settings.muteAudio` after init and follows `addSettingsChangeListener`; `MuteSources` (audio/mute.ts) holds the ad mute and the portal mute apart so sound returns only when neither asks; saved sound settings untouched. 591 tests, build and build:portal pass. Queue empty now.

- 2026-11-16: CrazyGames Instant Multiplayer: `isInstantMultiplayer()` (services/crazygames_room.ts) + `sdkEntry(invite, instant)` (flow/crazy_join.ts): instant = skip quick start, open Multiplayer and `online.createNow()` with the saved name and colour; an invite wins; a failed create shows today's error on the Multiplayer screen. Normal build unchanged. 585 tests, build, build:portal and online-check pass.

- 2026-11-16: CrazyGames room data replaces the deprecated invite button: new src/services/crazygames_room.ts (`updateRoom` with roomId / isJoinable / inviteParams, repeats skipped; `leftRoom`; `onJoinRoom` listener), lobby sets joinable by free seat, round start = not joinable, leaving = leftRoom; join from the CrazyGames UI opens Multiplayer with the code only from a menu / Story map / Multiplayer screen (flow/crazy_join.ts). Old showInvite/hideInvite removed. 583 tests, build, build:portal and online-check pass.

- 2026-11-16: Split src/flow/online.ts: lobby rendering to online_lobby.ts (138), create/join/rejoin flow to online_join.ts (115), prefs helpers to online_prefs.ts (28); online.ts 509 -> 288 lines, no behaviour change. 575 tests, build, shots and online-check pass.

- 2026-11-15: Story progress on the CrazyGames account: `save()` also writes SDK.data; when the SDK is ready the account copy is sanitized, merged with the local one (`mergeSaved`: best of each field, seen lists joined, introPending only if both) and saved to both; the Story map refreshes if open; no SDK = localStorage only. 575 tests, build and build:portal pass. Not checked: whether the data module must be switched on in the CrazyGames developer page (docs search returned no text); worth a look at upload.

- 2026-11-15: CrazyGames username as the leaderboard name: the SDK user module (getUser + auth listener) gives a logged-in username, cleaned to our name rules (`usernameToName`; unusable = device name); scores are sent with it (`displayName()`), the leaderboard name field shows it read-only with a hint (`lb.fromCrazyGames`), updates on a login during play. 564 tests, build and build:portal pass.

- 2026-11-15: CrazyGames midgame ads, switched off: `CRAZY_ADS` (false) in config/portal.ts; `midgameAd()` / `adsAvailable()` / `afterMidgameAd()` in the SDK wrapper (5 s start limit, never rejects); sound muted and taps shielded while an ad plays (flow/ad_shield.ts); call points on Story Next level / Retry, Battle vs Bot end screen, leaving an online room (flow/ad_points.ts). With the switch off the actions run in the same call as before. 554 tests, build and build:portal pass.

- 2026-11-15: Split story_mode.ts: level-clear and game-over banners moved to src/flow/story_results.ts (story_mode.ts 290 lines, story_results.ts 93), no behaviour change. Tests, build and shots pass.

- 2026-11-14: CrazyGames invite button + instant join: lobby shows the SDK invite button for its room and hides it on close, leave or round start; a page opened from a CrazyGames invite opens Multiplayer with the code filled in and skips quick start (our `?room=` unchanged). 534 tests, build, shots and online-check pass.

- 2026-11-14: CrazyGames gameplay start/stop: `setGameplay(active)` called every frame from the main loop (round playing and not paused); the SDK hears changes only, state re-sent once when init finishes; our own site makes no call. 531 tests and build pass.

- 2026-11-14: CrazyGames SDK loader: `CRAZY_SDK` switch, `initCrazySdk()` in src/services/crazygames.ts loads the v3 script at boot in the portal build only (no reference in the normal build; build:portal now checks it is there), failures caught and warned once. 528 tests, build, portal build and shots pass.

- 2026-11-14: Chromebook frame-rate check: `npm run perf` (scripts/perf_check.mjs) plays 20 s of Story level 1 and 20 s of Battle vs Bot at 1366x768, CPU 4x throttled, prints avg fps, 1% worst frame and draw calls; numbers in PORTAL.md; low-fps Known issue replaces the untested one. Battle vs Bot has 2 players (you and the bot), not 4.

- 2026-11-14 (Director run, Refindo: "run it now"): quick start for first-time portal players: one tap lands in Story level 1; the opening crawl and prologue play once as a look back before the next level; once per save, never for a room invite, our own site unchanged (D-1, veto by 2026-11-16). Analytics events carry their source (site / crazygames; D-2) with queries for the numbers CrazyGames judges. Independent review found and fixed 4 bugs before the push (invite ignored, repeat on every visit, story lost if interrupted, level running under the splash). Hibernation closed as not needed now (D-3). The stale M0 / portal lock from 2026-11-10 was released: M0 is done apart from the items under Needs Refindo. 522 tests pass.

Older entries: docs/CHANGELOG.md.
