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

Only you can do these. Ranked by what they unblock; everything else is prepared.

1. **Upload today's zip to CrazyGames and finish the submission**, about 15 min. Everything built since 2026-11-14 (CrazyGames login, progress saved to the account, their invite and instant-join, username on the leaderboard) only reaches portal players through a new upload: CrazyGames runs the zip you gave it. Zip: `npm run build:portal`, or the "spaceblast-portal" file on the latest GitHub Test run. Listing text, covers and videos: `docs/LISTING.md`, `listing/`. If the game is still a draft, press Submit; if it is in review or live, upload the new version. Analytics shows no CrazyGames players since your own test on 2026-11-14, so it is not live yet. Before ticking "someone other than you has tested it", have one friend play a few levels.
2. **`npx wrangler login` once on your computer** (2 min, optional): then `npm run metrics` prints the weekly report there. Agents can also run it for you through the Cloudflare connection.
3. **Phone check** (1 min): the last open line in docs/PHONE_TEST.md (floating stick at rest), plus the bonus-heart HUD below when ads are on.
4. **Chromebook check** (when you have one at hand): CrazyGames wants smooth play on a 4 GB Chromebook; open the game there and play a level (Known issues).
5. **Traffic analytics token** (5 min, optional): `VITE_CF_BEACON_TOKEN` in Vercel (docs/ANALYTICS.md part 1).
6. **Decisions made for you**: docs/DECISIONS.md. D-4 and D-5 can be vetoed until 2026-11-30.

## Ready

## In progress


## Blocked

- **Later (postponed by Refindo until the product is ready, no cost now): Capacitor app packaging** - landscape lock, native haptics (@capacitor/haptics: light impact on Charge / power-up, warning on damage). The web build already buzzes via navigator.vibrate on Android.

## Known issues

Open bugs and debts, newest first. The Producer turns these into Ready items when the milestone allows; fixed ones move to Done.

- **Frame rate under 50 fps in `npm run perf`** (4 GB Chromebook, a CrazyGames requirement, docs/PORTAL.md): Story level 1 2.3 fps avg, Battle vs Bot 2.2 fps, with 4x CPU throttling and software drawing (no GPU in the cloud run), so this says little about a real Chromebook. Needs a run on a real one (Refindo) or a GPU-backed machine before any optimising.


## Done

- 2026-11-28 (Director run, Refindo: "execute plan today"): `npm run metrics` weekly report (src/services/metrics_report.ts + test + fixture, scripts/metrics_report.mjs, ANALYTICS.md "Weekly report"; checked against the live D1 rows). Rewarded extra heart: `bonusLives` GameOption (0-1, player 0, Story only, in hashState via lives), "+1 heart (ad)" on the Story game-over card only when `adsAvailable()` (CRAZY_ADS still false, so nobody sees it yet), retry with 4 hearts only if the ad finished; score and stars use `heartsForScore` (as if 3 hearts); leaderboard server accepts hearts_left 0 (a clear on the bonus heart); HUD draws 4 hearts in one row and keeps a lost bonus heart as lost; pause Restart keeps a watched-for heart (D-5). Independent review found 6 problems, all fixed before the push (an empty button on every banner, bonus clears rejected by the leaderboard, the two retry buttons not locking each other, a late ad result starting a level over the map, the HUD wrap, misleading metrics errors). Screenshot check made tolerant of slow CI (the 2026-11-24 red run). CrazyGames login calls checked against docs.crazygames.com (user module): they match. 620 tests, build, build:portal, shots and online-check pass.

- 2026-11-28: Refindo answered both Blocked questions: the rewarded bonus heart does not count for score and stars; start M3's weekly metrics report now. Both queued.

- 2026-11-22: "Log in with CrazyGames" button on the leaderboard screen (`#lb-login`, `lb.crazyLogin`): `canShowLogin()` / `showLogin()` (never rejects) in crazygames.ts; shown only with the SDK ready, accounts available and nobody logged in; after a login Story progress is merged again (new flow/account_sync.ts `watchAccountMerge`, used by story_mode.ts). 612 tests, build and build:portal pass. Not checked: docs.crazygames.com could not be fetched in this run; `isUserAccountAvailable` / `showAuthPrompt` follow the item text, worth a re-read.

- 2026-11-21: Split src/flow/online.ts 311 -> 250 lines: server message handling to src/flow/online_messages.ts (`handleServerMsg`, `MessageHost`), no behaviour change. 604 tests, build, shots and online-check pass.

- 2026-11-21: `rewardedAd(deps): Promise<boolean>` in src/services/crazygames_ads.ts (true only on adFinished; false when ads off / no SDK / ad blocker / adError / 5 s timeout; same `onAdState` hook; no call site). 604 tests, build and build:portal pass. Not checked: docs.crazygames.com/sdk/html5-v3 could not be fetched in this run; call shape follows the midgame wrapper and the spec.

- 2026-11-21: Moved the CrazyGames ad code (midgame ads, adblock check, `onAdState`) to src/services/crazygames_ads.ts; crazygames.ts 307 -> 229 lines, no behaviour change. 597 tests, build and build:portal pass.

Older entries: docs/CHANGELOG.md.
