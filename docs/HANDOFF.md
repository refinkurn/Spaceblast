# Handoff

The single queue between story/design (Claude chat, Web-Mobile Game project) and build (Claude Code).
Both sides read this first and update it last. Keep it short: finished items move to Done with one line, then get deleted after a week.

## How it works

- **Chat** writes specs to `docs/story/<topic>.md` or `docs/design/<topic>.md`, then adds a line under Ready.
- **Claude Code** takes the top Ready item, moves it to In progress, builds it, runs the qa-runner agent, commits to `main`, and moves it to Done.
- Anything that needs Refindo's decision goes under Blocked, with the question.

Designated build session (main code agent): https://claude.ai/code/session_01XC77HfFWyx7am3DE4jJY5f

Agents (in `.claude/agents/`): `script-integrator` (Haiku, story text), `qa-runner` (Haiku, tests and checks), `sim-specialist` (Opus, game rules and online). The main session runs on Sonnet.

## Ready

- **Fix 7 script lines to match the game** (approved by Refindo, 2026-10-20). Text only; use the wording exactly.
  1. Level 5 intro, Kit (story_scenes.ts): "You need to destroy it." → "Survive its waves. When it's spent, it collapses."
  2. Level 4 briefing (story.ts CONTEXT): → "Watch the creatures. Stay alert."
  3. Goopling card (alien_cards.ts): → "Gooplings wander slowly. Touching one bites you."
  4. Sniffer card and level 3 briefing: → "Sniffers dodge your blasts. Trap them in a corridor." Level 3 tutorial step (tutorial_script.ts): → "Sniffers dodge blasts. Corner them."
  5. Freeze Pulse card (powerup_cards.ts): → "Freezes every Martian for 3 seconds, as soon as you pick it up."
  6. Oxygen Vest card (powerup_cards.ts): → "Absorbs one hit and gives you a short shield."
  7. Level 15 intro, Bosco (story_scenes.ts): "Then I'll break both." → "Then I'll break it."

## In progress

## Blocked

- **Story continuity fixes** (proposed by story chat, waiting for Refindo). Text only, no new shots.
  A. Cores theft is never explained. Prologue, Capybara: "But the cargo bay—it's open." → "And that creature ripped the cargo bay open." / "The power cores. They're gone." → "The power cores. It took them."
  B. The distress signal is never explained. Level 15 outro, Unknown voice: "I've been luring ships here for five years." → "I've been luring ships here for five years. One little distress call at a time."
  C. Ducking's backstory still uses the old "abandoned castaway" version; the new canon is a wanted criminal who chose to hide on Mars. Level 20 intro, Kit: "He was reported missing five years ago." → "He's wanted by the Galactic Police. He vanished five years ago." Ducking: "I've been surviving. The Division left me here to die. Mars would've been my grave. But I learned. I adapted. I found a way." → "I've been hiding. The Galactic Police wanted me for what I can do. Mars was the one place they'd never follow." (This also removes "The Division", which was never introduced.)
  D. There are no humans in this world. Level 10 outro narration: "A voice. Human. Artificial." → "A voice. Not Martian. Not machine."
- **Code agent:** add the remaining items from your old contradictions list here (the ones not covered above), one line each with the current text.

## Done
