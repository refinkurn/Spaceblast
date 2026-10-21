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

## In progress

## Blocked

- (none)

## Done

- 2026-10-21: bot retune (Refindo): Normal ~20% softer (notices blasts at 2 s, 20% slower bombing, more pauses, hunts 80% of the time); Easy busier but beginner-friendly (strolls instead of parking, hunts 25%, still slow to dodge). Bot-vs-bot: Normal-Easy 23-5 -> 17-10, Hard-Normal 16-6 -> 17-9. Fixed a collapse bug: an astronaut grazed by a falling block could walk back inside it and survive, so the round never ended. 147 tests pass.
- 2026-10-21: opening pop-up no longer repeats Kit's Warp Gate line; now covers rocks, power-ups and your own charges. 146 tests pass.
- 2026-10-21: plot holes closed with Refindo's 17 answers (cores, the herd, radiation, maintained shafts, who moves the maze, hive rules, ruined ships left open, weapon target, biotech control, stun, recalibrating cores, warp lines, cover-up, Ducking's station). Editorial trim pass. Canon in docs/story/canon.md. 146 tests pass.
- 2026-10-21: online responsiveness: your own astronaut and charges are drawn from a local prediction (src/net/predict.ts), so a press shows in ~1 frame instead of a round trip + margins (~120 ms on localhost, ~200+ ms on real connections). Bot stutter fixed: bots wobbled around tile centres on ~1 tick in 4 (steering back to a centre they overshot) and dawdled per tick; now they glide to the centre and dawdle as one pause. 146 tests pass.
- 2026-10-20: gameplay/perf batch (Refindo, direct): beams fade out harmlessly for their last 10 ticks (danger time still 0.5 s); respawn never lands on a rock (nearest free tile) and Maze Shift keeps spawn corners clear; online jitter buffer + ping-spike-aware input timing + 60 fps cap (fixes freeze-then-rush lag); warning pop-up 20% smaller and quicker; left mouse click charges. 141 tests pass.
- 2026-10-20: level 1 tutorial step `martian` now reads "Martians bite when they touch you. Keep your distance." 132 tests pass.
- 2026-10-20: 7 script lines fixed to match the game (boss waves, Goopling, Sniffer x3, Freeze, Oxygen Vest, "break it"). 132 tests pass.
- 2026-10-20: story continuity A-D applied: cores taken by the creature, distress call revealed as a lure, Ducking is a wanted criminal hiding on Mars (the Division is gone from the script), level 10 voice "Not Martian. Not machine."
