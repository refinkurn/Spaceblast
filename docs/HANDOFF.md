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

## In progress

## Blocked

- **Script lines that don't match the game.** Decide for each: change the line (suggested wording) or change the game.
  1. Level 5 intro, Kit: "You need to destroy it." → "Survive its waves. When it's spent, it collapses."
  2. Level 4 briefing: "getting more aggressive" → "Watch the creatures. Stay alert."
  3. Goopling card: "aggressive and persistent" → "Gooplings wander slowly. Touching one bites you."
  4. Sniffer card, level 3 briefing and tutorial step: "track movement" → "Sniffers dodge your blasts. Trap them in a corridor." (tutorial step needs its own line, e.g. "Sniffers dodge blasts. Corner them.")
  5. Freeze Pulse card: "nearby threats temporarily" → "Freezes every Martian for 3 seconds, as soon as you pick it up."
  6. Oxygen Vest card: "hazardous environments" → "Absorbs one hit and gives you a short shield."
  7. Level 15 intro, Bosco: "Then I'll break both." → "Then I'll break it."

## Done
