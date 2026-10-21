# Handoff

The single queue between story/design (Claude chat, Web-Mobile Game project) and build (Claude Code).
Both sides read this first and update it last. Keep it short: finished items move to Done with one line, then get deleted after a week.

## How it works

- **Chat** writes specs to `docs/story/<topic>.md` or `docs/design/<topic>.md`, then adds a line under Ready.
- **Claude Code** takes the top Ready item, moves it to In progress, builds it, runs the qa-runner agent, commits to `main`, and moves it to Done.
- Anything that needs Refindo's decision goes under Blocked, with the question.

Day-to-day guide: docs/PLAYBOOK.md. A nightly run (01:52 Jakarta) takes up to 4 Ready items from the top, one at a time (text, UI, input, assets, tests only).

Designated build session (main code agent): https://claude.ai/code/session_01XC77HfFWyx7am3DE4jJY5f

Agents (in `.claude/agents/`): `script-integrator` (Haiku, story text), `qa-runner` (Haiku, tests and checks), `sim-specialist` (Opus, game rules and online). The main session runs on Sonnet.

## Ready

- **Invite link + reconnect screen** (src/flow/online.ts, main.ts, index.html `#online`)
  Now: share the 4-letter code by hand; only a "Reconnected!" flash.
  Want: Invite button (share sheet or copy `?room=CODE`); opening that link fills the code; full-screen "Reconnecting to room CODE…" while the link retries.
  Done when: link opens Multiplayer with the code; reconnect screen shows and hides; tests cover `?room=` parsing.
  Spec: docs/design/polish-settings-net.md (part 3)
- **Power-up pick-up look** (src/view/actors_view.ts `ItemsView`, effects_view.ts)
  Now: plain coloured shapes (cone, sphere, box, octahedron, torus) bobbing and spinning fast.
  Want: low-poly item meshes in the new colours inside a glass shell, floor aura, shared idle particles, spawn/collect bursts; slow 30 deg/s spin; aura and particles off at reduced quality.
  Done when: all 5 items are easy to tell apart in a dev level; tests and build pass.
  Spec: docs/design/powerup-look.md (part 1)
- **Vest bubble, speed trail, new power-up icons** (src/view/hero_view.ts, src/flow/hud.ts)
  Now: plain bubble; no speed trail; simple HUD icons.
  Want: pulsing pale bubble while armor > 0; short yellow trail while moving with boots; new SVG icons in HUD and intro cards (pips stay).
  Done when: bubble and trail behave as specced; icons match; tests and build pass.
  Spec: docs/design/powerup-look.md (part 2)

## In progress

## Blocked

- (none)

## Done

- 2026-10-21: start countdown 3-2-1-BLAST! (0.6 s steps, offline Story after the level card and Battle rounds; held by the paused flag; skipped when level 1's first coach prompt is pending), red damage vignette (CSS, reduced-motion softer) on life/armor loss, vibration 30 ms on placing a Charge and 80 ms when hurt; logic in `src/flow/countdown.ts`; 209 tests pass. Not checked in a real browser or on a phone.
- 2026-10-21: Story score + online leaderboard (Refindo, direct): score = clear 2,000 + 500/Martian + time under par x20 + 1,000/heart; new stars (target score, 3 = all hearts under par); no-login device profile + name word filter; POST/GET /api/scores on a Cloudflare Durable Object (caps, 3 s / 300-a-day limits) and in the dev server; offline queue; Leaderboard screen on the level map. Needs `npm run deploy` to go live. Spec: docs/design/leaderboard.md. 199 tests pass.
- 2026-10-21: settings: Joystick Floating/Fixed (fixed = base bottom-left of the gutter above the safe area, steers relative to it; instant) and Vibration On/Off (shown only where `navigator.vibrate` exists); both saved; `haptics.buzz()` ready for part 2 of the countdown item; checked in the browser at 740x360; tests for load/defaults and stick geometry; 182 tests pass.
- 2026-10-21: lobby slot cards: P1-P4 cards (players, then bots, then OPEN; HOST/BOT/OPEN tags); host taps OPEN to add a bot and BOT to remove one via the existing `bots` setting; stepper removed (Bot level Easy/Normal/Hard stays); logic in `src/flow/lobby_slots.ts`; tapped through against the dev room server at 740x360; 177 tests pass.
- 2026-10-21: end-of-match screen: VICTORY / DEFEATED / DRAW / LEVEL CLEAR / SURVIVED! title, Bosco happy/defeated sprite, summary (Story: time, lives lost, stars, Martians cleared; battle: round time + score), full-screen dim backdrop, "Main menu" button; boss clears now say "Hive ruptured!" / "Maze Master survived!" (never "destroyed"); words in `src/flow/summary.ts`; battle card checked at 740x360; 174 tests pass.
- 2026-10-21: pause menu: 48 px pause button, PAUSED card (Resume, Restart level/round, Settings over the card, Quit with confirm), Escape/P toggles, auto-pause when the tab hides (offline); online keeps the leave prompt; logic in `src/flow/pause.ts`; checked in the browser at 740x360; 169 tests pass.
- 2026-10-21: story dialogue banner: slim full-width bottom banner (min 84 px, grows for a 3rd line), 64 px portrait (hidden on narration), 13 px name, 16-20 px text, sprite sits above it, Skip 64x48; checked at 740x360; CSS tests (vitest now processes style.css); 166 tests pass.
- 2026-10-21: menu: Story / Versus (Battle vs Bot, Multiplayer) / Settings (How to Play inside) / Credits; Back is first and pinned top-left on every sub-page (bot -> Versus, How to Play -> Settings); online lobby sits in a left panel (min(420px, 46vw)) with Back pinned top-left; checked at 740x360 (no page scroll); 5 new tests, 163 pass. Note: the menu art is not shown behind the lobby (the menu hides when the lobby opens).
- 2026-10-21: HUD layout: top-left avatar + hearts + power-ups + short goal, top-centre stage chip with clock (boss/battle only), title dropped, hearts shake and flash on life/armor loss (CSS, reduced-motion safe); text logic in `hud_text.ts`; checked at 740x360; 5 new tests, 158 pass.
- 2026-10-21: compact level card: `1-3` / `1-5 BOSS` title, sector name, goal icon + text, Kit line only, dim backdrop; Bosco reply no longer shown; 5 new tests, 153 pass.
- 2026-10-21: 4-player lag, step 1 (Refindo): measured the live room server from the dev PC: steady 60 Hz frames (worst gap 36 ms) but ~90 ms ping, so rooms are now placed in Asia-Pacific (`ROOM_REGION`) and report their data centre; on-screen stats line during online rounds (ping, wobble, buffer, late presses, fps, frame work; ONLINE.md explains it, `?nostats` hides it); lighter rendering on phones (no antialiasing on sharp screens, plain 512 px shadows, 1.5x resolution cap). Next: a 4-player test with screenshots of the stats line. 148 tests pass.
- 2026-10-21: bot retune (Refindo): Normal ~20% softer (notices blasts at 2 s, 20% slower bombing, more pauses, hunts 80% of the time); Easy busier but beginner-friendly (strolls instead of parking, hunts 25%, still slow to dodge). Bot-vs-bot: Normal-Easy 23-5 -> 17-10, Hard-Normal 16-6 -> 17-9. Fixed a collapse bug: an astronaut grazed by a falling block could walk back inside it and survive, so the round never ended. 147 tests pass.
- 2026-10-21: opening pop-up no longer repeats Kit's Warp Gate line; now covers rocks, power-ups and your own charges. 146 tests pass.
- 2026-10-21: plot holes closed with Refindo's 17 answers (cores, the herd, radiation, maintained shafts, who moves the maze, hive rules, ruined ships left open, weapon target, biotech control, stun, recalibrating cores, warp lines, cover-up, Ducking's station). Editorial trim pass. Canon in docs/story/canon.md. 146 tests pass.
- 2026-10-21: online responsiveness: your own astronaut and charges are drawn from a local prediction (src/net/predict.ts), so a press shows in ~1 frame instead of a round trip + margins (~120 ms on localhost, ~200+ ms on real connections). Bot stutter fixed: bots wobbled around tile centres on ~1 tick in 4 (steering back to a centre they overshot) and dawdled per tick; now they glide to the centre and dawdle as one pause. 146 tests pass.
- 2026-10-20: gameplay/perf batch (Refindo, direct): beams fade out harmlessly for their last 10 ticks (danger time still 0.5 s); respawn never lands on a rock (nearest free tile) and Maze Shift keeps spawn corners clear; online jitter buffer + ping-spike-aware input timing + 60 fps cap (fixes freeze-then-rush lag); warning pop-up 20% smaller and quicker; left mouse click charges. 141 tests pass.
- 2026-10-20: level 1 tutorial step `martian` now reads "Martians bite when they touch you. Keep your distance." 132 tests pass.
- 2026-10-20: 7 script lines fixed to match the game (boss waves, Goopling, Sniffer x3, Freeze, Oxygen Vest, "break it"). 132 tests pass.
- 2026-10-20: story continuity A-D applied: cores taken by the creature, distress call revealed as a lure, Ducking is a wanted criminal hiding on Mars (the Division is gone from the script), level 10 voice "Not Martian. Not machine."
