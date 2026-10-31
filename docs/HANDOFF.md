# Handoff

The single queue between story/design (Claude chat, Web-Mobile Game project) and build (Claude Code).
Both sides read this first and update it last. Keep it short: finished items move to Done with one line, then get deleted after a week.

## How it works

- **Chat** writes specs to `docs/story/<topic>.md` or `docs/design/<topic>.md`, then adds a line under Ready.
- **Claude Code** takes the top Ready item, moves it to In progress, builds it, runs the qa-runner agent, commits to `main`, and moves it to Done.
- Anything that needs Refindo's decision goes under Blocked, with the question.

Day-to-day guide: docs/PLAYBOOK.md. Vision and milestones: docs/ROADMAP.md (the Producer queues from it daily, 00:44 Jakarta). Phone checks waiting for Refindo: docs/PHONE_TEST.md. A nightly run (01:52 Jakarta) takes up to 4 Ready items from the top, one at a time (text, UI, input, assets, tests only).

Designated build session (main code agent): https://claude.ai/code/session_01XC77HfFWyx7am3DE4jJY5f

Agents (in `.claude/agents/`): `script-integrator` (Haiku, story text), `qa-runner` (Haiku, tests and checks), `sim-specialist` (Opus, game rules and online). The main session runs on Sonnet.

Hosting (details in ONLINE.md): game page on Vercel, https://spaceblast.vercel.app (every push builds it; `main` = live). Rooms + leaderboard on Cloudflare, https://spaceblast.refinkurn.workers.dev: pushing does not update them, so a change in `server/` or `src/net/` also needs `npm run deploy` (by Refindo or the code session, never the nightly run). Fly.io server code is in the repo but not deployed (not free).

## Ready

- **3D Ducking matches his canon colours** (src/view/astronaut_mesh.ts, level 20 duel)
  Now: the low-poly Ducking wears a dark violet suit (DUCK_SUIT 0x4b2a7a) and has a yellow duck head (the shared `duck` material).
  Want: yellow suit with a dark hazard band or black chest panel, dark grey head feathers, black eyepatch box over one eye, keep the orange bill; match the 2D art palette in src/assets/characters/ducking/ (palette in ducking-sprite-spec.md). Bosco and online players unchanged.
  Done when: level 20 (open with #dev) shows Ducking yellow-and-black with grey feathers and an eyepatch, clearly different from Bosco at phone size; npm test passes; screenshot attached to the Done line.

## In progress

## Blocked

- **Design chat: gameplay balance proposal** (from Refindo's "production readiness" brief, 2026-10-22). Not built: it changes rules and canon, so it needs a spec that fits the game first. The brief asked for:
  - Rock drop table: empty 40%, "dot gem" 30%, extra charge 15%, speed boots 10%, oxygen vest 5%. Today: 1 rock in 6 hides a power-up (about 83% empty); items are Beam Range+, Extra Charge, Speed Boost, Freeze Pulse, Oxygen Vest; there is no gem (it would need a purpose: score? currency?).
  - Stages 1-1..1-4 with "Roamer"/"Chaser" Martians (1-3: 2 Roamers + 2 Chasers; 1-4: 4 Chasers), par 90/80/75/60 s, low-to-high rock density per stage. Today: Gooplings and Sniffers in sector 1, only sector 4 Martians hunt (canon), par 75 s on every normal level, one rock density (60%), and 1-4 is a normal level before the 1-5 boss.
  - "gameplay_config.json / stages.json": rules live in typed integer constants in src/sim (deterministic for online play); a JSON file is possible later if the design team wants to edit numbers, as long as it stays integers.
  Please decide which parts to keep, in canon terms, and queue a spec; rules changes go to the code session (sim-specialist), not the nightly run.
- **Later (postponed by Refindo until the product is ready, no cost now): Capacitor app packaging** - landscape lock, native haptics (@capacitor/haptics: light impact on Charge / power-up, warning on damage). The web build already buzzes via navigator.vibrate on Android.

## Done

Older entries: docs/CHANGELOG.md.

- 2026-10-24: sector arenas (src/sim/arenas.ts, sim-specialist): 1 Duststorm Valley open dunes, 2 Mining Colony corridors, 3 Crystal Core crystal clusters, 4 Bio-Lab rooms with doorways; same 13x11, mirror-symmetric, every tile reachable, boss tile clear; Maze Shift, Builders, gate, collapse, respawn and bots tested on every layout. Story uses its sector's arena; Battle vs Bot a random one per round; Online has an Arena lobby setting (sector or Random, picked from the round seed); each arena wears its sector's look. Needs `npm run deploy` for the room server. 449 tests pass.
- 2026-10-24: sector names follow the map art: Duststorm Valley, Abandoned Mining Colony, Crystal Core, Underground Bio-Lab (story text, scenes, map, docs). Low-poly rocks per sector (src/view/rock_mesh.ts: boulders, quarried chunks, amber crystal clusters, crates). Boss levels: a stopwatch for the last 15 s of the final wave, beeps on the last 5. 381 tests pass.
- 2026-10-24: end-of-match stats as a column list (label left, value right): Score, Stars, Time, Hearts left, Martians defeated, Rocks destroyed, Power-ups; the score breakdown row is gone (src/flow/match_tally.ts counts from sim events). Story map nodes are glass hexagon badges like difficulty badges: sector 1 green, 2 blue, 3 violet, 4 magenta, bosses red, the duel gold, locked dark with a '?'; earned stars glow inside. 379 tests pass.
- 2026-10-24: low-poly Martians (Goopling octopus, Sniffer snout + legs, Phaser jellyfish, Builder crab with claw slap) and bosses (Goopling Hive, Darkness Hive with arcs, Maze Master core + orbiting blocks). docs/design/martian-look.md. 378 tests pass.
- 2026-10-24: arena colours no longer clash with gameplay colours: sector 1 floor darker rust + sand rocks, sector 2 softer rust rocks, sector 3 dark slate floor + amber crystal rocks (was violet like Sniffers/Phasers, green rocks like Gooplings), sector 4 steel floor + tan crates (was near-white, hiding the beam core). Maze Shift 'vanish' warning is magenta (was red on red). Gameplay colours live in src/view/play_colors.ts; sector_look.test.ts fails if a sector's floor or rocks look like a beam, a Martian, a warning or the open gate. 375 tests pass.
