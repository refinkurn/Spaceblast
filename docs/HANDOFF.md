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

## Ready

Queued 2026-11-03 by Refindo ("fix all known issues tonight"). Items 1-2 fit the nightly run; 3-7 touch server/ or src/net/, so the nightly skips them and the code session (sim-specialist) takes them.

- **Online: host restarts a round mid-round** (server/room.ts) [code session]
  Now: `start` is accepted while a round runs.
  Want: ignore `start` until the round is over.
  Done when: room test covers it.
- **Online: nameless `profile` resets the name** (server/room.ts) [code session]
  Now: a `profile` without a name becomes "Player N".
  Want: keep the seat's current name when the field is missing or empty.
  Done when: room test covers it.
- **Debt: split server/room.ts** (about 400 lines) [code session]
  Want: round clock in its own file, room.ts under ~300 lines, no behaviour change.
  Done when: all room tests pass unchanged.
- **Debt: Durable Object hibernation for idle lobbies** [code session]
  Want: change the ping protocol so idle lobbies can hibernate (WebSocket hibernation API), then enable it.
  Done when: room tests pass and an idle lobby shows no running clock.

## In progress

- 2026-11-08: the five online items (version check on join, host restart, nameless profile, room.ts split, hibernation) are with sim-specialist in the code session.

## Blocked

- **Online: version check on join** (src/net/, server/room.ts) [code session] - Blocked 2026-11-07 by the nightly run: needs src/net/ and server/ (online sync), outside its scope; the code session (sim-specialist) takes it. The nightly also cannot build the other Ready items (all server/ or src/net/).
- **Later (postponed by Refindo until the product is ready, no cost now): Capacitor app packaging** - landscape lock, native haptics (@capacitor/haptics: light impact on Charge / power-up, warning on damage). The web build already buzzes via navigator.vibrate on Android.

## Known issues

Open bugs and debts, newest first. The Producer turns these into Ready items when the milestone allows; fixed ones move to Done.

- **Online: the host can restart a round mid-round** (server/room.ts) [code session].
- **Online: a `profile` message without a name resets the player to "Player N"** (server/room.ts) [code session].
- **Online: a room mixing an old cached page with a new one desyncs until everyone refreshes** (after a deploy). Needs a version check on join [code session].
- **Debt: server/room.ts is about 400 lines** (rule: under ~300); split the round clock out [code session].
- **Debt: Durable Object hibernation for idle lobbies** needs a ping protocol change first (assessed, not built) [code session].

## Done

Older entries: docs/CHANGELOG.md.

- 2026-11-03: offline cache across a deploy: sw.js now keeps the previous build's cache (older ones deleted) so an open tab's old art files still load; a failed lazy chunk reloads the page once (sessionStorage guard, no loop). Tests: old-page + new-cache SW case, reload-once. 493 tests pass.

- 2026-11-03: doc drift fixed: docs/design/powerup-look.md now describes what src/view draws (clear shell, no floor glow, no idle particles, hoverboard and shield looks, Star Dot); no mention of a floor aura.

- 2026-11-03: balance brief built (Refindo: "execute"). Rock drop table per rock (Story: empty 38, Star Dot 30, Extra Charge 8, Beam Range+ 7, Speed 10, Vest 5, Freeze 2; Battle: empty 68, no dots/freeze), Star Dots (+50 score, survive blasts, golden gem without shell, own stat row, blip sound, first-pickup card), Hungry Goopling "Chaser" (pink, chases within 4 path steps; card + 1-3/1-4 briefings), sector 1 rosters 2G / 3G / 2G+2C / 4C, par 90/80/75/60 s and rock density 50/55/60/65% per stage in every sector; leaderboard check accepts gems (old clients = 0). sim-specialist did src/sim, score, leaderboard. Battle now has ~32% power-up rocks (was ~17%), bots closer in skill. 489 tests pass. Story text for the Chaser/Star Dot is new: story chat may reword.
- 2026-11-03: analytics live. POST /api/events on the worker stores anonymous events (session start/end, daily retention, Story level start/clear/fail, battle rounds) in D1 `spaceblast-analytics`; queries in docs/ANALYTICS.md. Cloudflare Web Analytics waits for Refindo to set VITE_CF_BEACON_TOKEN in Vercel.

- 2026-11-01: Ducking v0.3 and Captain Kit v0.2 art swapped into src/assets/characters (final Ducking at 120 px, redrawn Kit worried/relieved portraits); art-drop/2026-11-01 removed; PHONE_TEST check added. 454 tests pass, build clean.

- 2026-10-31: Arcade-galactic type: Russo One 400 + Chakra Petch 500/700 (latin WOFF2 from @fontsource, OFL licences in public/fonts), tokens --font-display/--font-label/--font-body, roles applied in a final block of src/style.css, font-display swap, nothing from Google; the three woff2 files (~27 kB) are in the build, so sw.js caches them. Main JS unchanged (820 kB), CSS +1 kB. Checked at 896x414: menu title and HUD stage chip show the faces (docs/design/shots/type-menu.png, type-hud.png). NOT checked: level card, end-of-match screenshots, long labels like ABANDONED MINING COLONY, real airplane-mode reload (Refindo or next session to recheck; Chakra Petch 500 loads only when used). 454 tests pass.
- 2026-10-31: 3D Ducking in canon colours (astronaut_mesh.ts): yellow suit (fbd610), dark grey head, black eyepatch, black chest panel + hazard band (shown only with the duck head), orange bill kept; Bosco unchanged. Level 20 screenshot: docs/design/shots/ducking-3d.png (small at phone size, Ducking bottom-right). 453 tests pass.
- 2026-10-31: floating joystick: in Floating mode #stick-zone covers the whole left half below the HUD (HUD buttons sit above it); the base opens under the thumb, clamped only to the screen edges (floatingBounds); Fixed unchanged. Checked at 896x414 (zone 448x370). 452 tests pass. Refindo to recheck on the Meizu.
- 2026-10-31: iPhone home-screen crop: html/body/#game use 100% with a 100dvh override (@supports), relayout() also on load, pageshow and return to the app, plus after 300 ms and 1 s; layout test covers the rule. 450 tests pass. Refindo to recheck from the iPhone 11 home screen.
- 2026-10-24: sector arenas (src/sim/arenas.ts, sim-specialist): 1 Duststorm Valley open dunes, 2 Mining Colony corridors, 3 Crystal Core crystal clusters, 4 Bio-Lab rooms with doorways; same 13x11, mirror-symmetric, every tile reachable, boss tile clear; Maze Shift, Builders, gate, collapse, respawn and bots tested on every layout. Story uses its sector's arena; Battle vs Bot a random one per round; Online has an Arena lobby setting (sector or Random, picked from the round seed); each arena wears its sector's look. Needs `npm run deploy` for the room server. 449 tests pass.
- 2026-10-24: sector names follow the map art: Duststorm Valley, Abandoned Mining Colony, Crystal Core, Underground Bio-Lab (story text, scenes, map, docs). Low-poly rocks per sector (src/view/rock_mesh.ts: boulders, quarried chunks, amber crystal clusters, crates). Boss levels: a stopwatch for the last 15 s of the final wave, beeps on the last 5. 381 tests pass.
- 2026-10-24: end-of-match stats as a column list (label left, value right): Score, Stars, Time, Hearts left, Martians defeated, Rocks destroyed, Power-ups; the score breakdown row is gone (src/flow/match_tally.ts counts from sim events). Story map nodes are glass hexagon badges like difficulty badges: sector 1 green, 2 blue, 3 violet, 4 magenta, bosses red, the duel gold, locked dark with a '?'; earned stars glow inside. 379 tests pass.
- 2026-10-24: low-poly Martians (Goopling octopus, Sniffer snout + legs, Phaser jellyfish, Builder crab with claw slap) and bosses (Goopling Hive, Darkness Hive with arcs, Maze Master core + orbiting blocks). docs/design/martian-look.md. 378 tests pass.
- 2026-10-24: arena colours no longer clash with gameplay colours: sector 1 floor darker rust + sand rocks, sector 2 softer rust rocks, sector 3 dark slate floor + amber crystal rocks (was violet like Sniffers/Phasers, green rocks like Gooplings), sector 4 steel floor + tan crates (was near-white, hiding the beam core). Maze Shift 'vanish' warning is magenta (was red on red). Gameplay colours live in src/view/play_colors.ts; sector_look.test.ts fails if a sector's floor or rocks look like a beam, a Martian, a warning or the open gate. 375 tests pass.
