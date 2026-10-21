# Handoff

The single queue between story/design (Claude chat, Web-Mobile Game project) and build (Claude Code).
Both sides read this first and update it last. Keep it short: finished items move to Done with one line, then get deleted after a week.

## How it works

- **Chat** writes specs to `docs/story/<topic>.md` or `docs/design/<topic>.md`, then adds a line under Ready.
- **Claude Code** takes the top Ready item, moves it to In progress, builds it, runs the qa-runner agent, commits to `main`, and moves it to Done.
- Anything that needs Refindo's decision goes under Blocked, with the question.

Day-to-day guide: docs/PLAYBOOK.md. A nightly run (01:52 Jakarta) takes the top Ready item (text, UI, assets, tests only).

Designated build session (main code agent): https://claude.ai/code/session_01XC77HfFWyx7am3DE4jJY5f

Agents (in `.claude/agents/`): `script-integrator` (Haiku, story text), `qa-runner` (Haiku, tests and checks), `sim-specialist` (Opus, game rules and online). The main session runs on Sonnet.

## Ready

- **Compact level card** (`#level-card`, src/flow/story.ts `levelCard`, screens.ts, style.css)
  Now: wide card with LEVEL n, sector, Kit briefing and Bosco reply.
  Want: ~320x180 card: big `1-3` title, sector name, goal icon + text, Kit line only; dim backdrop; same pause/tap logic.
  Done when: levels 1, 5, 8 show it; tests cover title and goal per level type.
  Spec: docs/design/hud-intro.md (part 1)
- **HUD layout + life-lost flash** (src/flow/hud.ts, index.html `#hud`, style.css)
  Now: one top bar row; goal hidden on phones; no feedback on losing a life.
  Want: top-left avatar + hearts, power-ups and goal under them; top-centre stage chip + clock (boss/battle only); buttons stay top-right; hearts flash on life or armor loss.
  Done when: fits a 740x360 landscape viewport with no overlap; tests and build pass.
  Spec: docs/design/hud-intro.md (part 2)
- **Menu: 4 buttons + Versus page** (src/flow/menu.ts, index.html `#menu`, `#online`, style.css)
  Now: 6 buttons (Story, Battle vs Bot, Multiplayer, Settings, How to Play, Credits); Back at the bottom; lobby is a centred card.
  Want: Story / Versus (Battle vs Bot, Multiplayer) / Settings (How to Play inside) / Credits; Back pinned top-left; lobby in the left panel.
  Done when: all paths work by tap and keyboard; no page scroll at 740x360; tests and build pass.
  Spec: docs/design/menu-dialogue.md (part 1)
- **Story dialogue banner** (src/flow/cutscene.ts, index.html `#cutscene`, style.css)
  Now: tall dialogue box, 76 px portrait.
  Want: slim full-width bottom banner (~84 px), 64 px portrait, 12-13 px name, 16 px+ text; standing sprite and Skip stay.
  Done when: prologue reads well at 740x360 with no overlap; tests and build pass.
  Spec: docs/design/menu-dialogue.md (part 2)
- **Pause menu** (src/main.ts `openMenu`/loop, index.html `#hud`, style.css)
  Now: the HUD Menu button quits straight to the main menu; no pause.
  Want: 48 px pause button opens a card (Resume, Restart, Settings, Quit with confirm); pauses via the loop flag; online keeps the leave prompt.
  Done when: pause/resume continues exactly; restart and quit work; tests and build pass.
  Spec: docs/design/match-screens.md (part 1)
- **End-of-match screen + boss title fix** (src/flow/screens.ts `#banner`, story_mode.ts, main.ts)
  Now: text banner; boss clears say "<boss> destroyed!" (against canon).
  Want: VICTORY / DEFEATED / LEVEL CLEAR title, Bosco happy/defeated sprite, summary (time, lives lost, stars, Martians cleared; battle: time + tally); boss title says survived/ruptured.
  Done when: Story clear, game over and battle round all show it; tests cover summary text and boss title.
  Spec: docs/design/match-screens.md (part 2)
- **Lobby slot cards** (src/flow/online.ts, index.html `#online-lobby`, style.css)
  Now: player list + bots stepper.
  Want: 4 slot cards (players, then bots, then OPEN); host taps OPEN to add a bot, BOT to remove one (existing `bots` setting); stepper removed.
  Done when: adding/removing bots by tap works and a 4th player joining still works; tests and build pass.
  Spec: docs/design/match-screens.md (part 3)
- **Settings: joystick mode + vibration** (src/flow/settings.ts, src/input/touch.ts, index.html `#settings`)
  Now: control size, music and sound only; the stick always floats.
  Want: Joystick Floating/Fixed; Vibration on/off (shown only where `navigator.vibrate` exists); both saved and applied instantly.
  Done when: both joystick modes steer correctly; tests cover settings load/defaults.
  Spec: docs/design/polish-settings-net.md (part 1)
- **Start countdown + damage vignette + vibration** (src/flow/, main.ts, style.css)
  Now: play starts the moment the card closes; no damage feedback at screen edges.
  Want: 3-2-1-BLAST! (offline, held by the pause flag); red edge flash on life/armor loss; 30 ms buzz on placing a Charge, 80 ms when hurt.
  Done when: countdown before each Story level and Battle round; vignette shows; tests and build pass.
  Spec: docs/design/polish-settings-net.md (part 2)
- **Invite link + reconnect screen** (src/flow/online.ts, main.ts, index.html `#online`)
  Now: share the 4-letter code by hand; only a "Reconnected!" flash.
  Want: Invite button (share sheet or copy `?room=CODE`); opening that link fills the code; full-screen "Reconnecting to room CODE…" while the link retries.
  Done when: link opens Multiplayer with the code; reconnect screen shows and hides; tests cover `?room=` parsing.
  Spec: docs/design/polish-settings-net.md (part 3)

## In progress

## Blocked

- (none)

## Done

- 2026-10-21: 4-player lag, step 1 (Refindo): measured the live room server from the dev PC: steady 60 Hz frames (worst gap 36 ms) but ~90 ms ping, so rooms are now placed in Asia-Pacific (`ROOM_REGION`) and report their data centre; on-screen stats line during online rounds (ping, wobble, buffer, late presses, fps, frame work; ONLINE.md explains it, `?nostats` hides it); lighter rendering on phones (no antialiasing on sharp screens, plain 512 px shadows, 1.5x resolution cap). Next: a 4-player test with screenshots of the stats line. 148 tests pass.
- 2026-10-21: bot retune (Refindo): Normal ~20% softer (notices blasts at 2 s, 20% slower bombing, more pauses, hunts 80% of the time); Easy busier but beginner-friendly (strolls instead of parking, hunts 25%, still slow to dodge). Bot-vs-bot: Normal-Easy 23-5 -> 17-10, Hard-Normal 16-6 -> 17-9. Fixed a collapse bug: an astronaut grazed by a falling block could walk back inside it and survive, so the round never ended. 147 tests pass.
- 2026-10-21: opening pop-up no longer repeats Kit's Warp Gate line; now covers rocks, power-ups and your own charges. 146 tests pass.
- 2026-10-21: plot holes closed with Refindo's 17 answers (cores, the herd, radiation, maintained shafts, who moves the maze, hive rules, ruined ships left open, weapon target, biotech control, stun, recalibrating cores, warp lines, cover-up, Ducking's station). Editorial trim pass. Canon in docs/story/canon.md. 146 tests pass.
- 2026-10-21: online responsiveness: your own astronaut and charges are drawn from a local prediction (src/net/predict.ts), so a press shows in ~1 frame instead of a round trip + margins (~120 ms on localhost, ~200+ ms on real connections). Bot stutter fixed: bots wobbled around tile centres on ~1 tick in 4 (steering back to a centre they overshot) and dawdled per tick; now they glide to the centre and dawdle as one pause. 146 tests pass.
- 2026-10-20: gameplay/perf batch (Refindo, direct): beams fade out harmlessly for their last 10 ticks (danger time still 0.5 s); respawn never lands on a rock (nearest free tile) and Maze Shift keeps spawn corners clear; online jitter buffer + ping-spike-aware input timing + 60 fps cap (fixes freeze-then-rush lag); warning pop-up 20% smaller and quicker; left mouse click charges. 141 tests pass.
- 2026-10-20: level 1 tutorial step `martian` now reads "Martians bite when they touch you. Keep your distance." 132 tests pass.
- 2026-10-20: 7 script lines fixed to match the game (boss waves, Goopling, Sniffer x3, Freeze, Oxygen Vest, "break it"). 132 tests pass.
- 2026-10-20: story continuity A-D applied: cores taken by the creature, distress call revealed as a lure, Ducking is a wanted criminal hiding on Mars (the Division is gone from the script), level 10 voice "Not Martian. Not machine."
