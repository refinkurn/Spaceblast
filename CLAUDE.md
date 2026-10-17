# Spaceblast — project rules

Bomberman-style 3D grid battle game: animal astronauts vs hungry Martians.
Web first (Vite + TypeScript + Three.js), wrapped for Android/iOS later with
Capacitor. Multiplayer is the main goal, so the simulation must stay deterministic.

## Commands

- `npm run dev` — dev server (also reachable from a phone on the same Wi-Fi)
- `npm test` — Vitest unit tests (must pass before every commit)
- `npm run build` — typecheck + production build into `dist/`
- `npm run deploy` — build and upload the game + online rooms to Cloudflare (see ONLINE.md)

## Architecture (do not break these)

```
src/
  sim/     game rules: plain TypeScript, deterministic, no DOM, no Three.js
  input/   devices -> PlayerCommand (keyboard, touch, bots)
  net/     online rooms: protocol, server frames (frames.ts), connection + reconnect (link.ts)
  view/    Three.js rendering; reads sim state, never writes it
  audio/   synthesised sound effects and music (Web Audio, no files); driven by sim events
  flow/    menus, HUD, story, online lobby
  main.ts  wiring + fixed 60 Hz loop
server/    the room server: room.ts (shared: seats, round clock, rejoin), dev_relay.ts (npm run dev), worker.ts (Cloudflare)
```

- Online play runs on the room server's clock: it sends every player's packed
  PlayerCommand for each tick and every browser plays those frames, so any
  non-determinism in `sim/` becomes a desync. Never read local-only data
  (time, window size, settings) inside `sim/`. Late commands never stall the
  others (the server repeats the last move); see ONLINE.md.

- `sim/` uses **integers only** for positions and timers: 1 tile = 1000 units
  (`TILE`), 60 ticks per second. No floats stored in state, no `Math.random()`,
  no `Date`/`performance.now()`, no DOM or Three.js imports.
- Randomness only via `sim/rng.ts` (state lives in `GameState.rng`).
- The sim only changes through `step(state, commands)`. Input never touches state.
- `hashState()` must cover every field that affects gameplay. Add new fields to it.
- Every new sim rule gets a Vitest test in `src/sim/*.test.ts`.
- Keep files under ~300 lines; split by feature.
- Mobile first: landscape only, touch controls live in the side gutters, the
  camera keeps the arena between them. Buttons >= 48 px.
- Keep the bundle small: no new runtime dependency without a reason.

## Game rules reference

The design doc (Spaceblast — Development Plan) is the source of truth for rule
numbers: 13x11 arena, pillars on odd/odd tiles, 2.5 s fuse, 1-tile beams; Beam Range+, Extra Charge and Speed Boost stack to 5, Oxygen Vest armor to 3, etc. Level and boss data: src/sim/levels.ts and src/sim/boss.ts (3 waves, each wait half the one before); story text: src/flow/story.ts, cutscene scripts: src/flow/story_scenes.ts, tutorial steps and tips: src/flow/tutorial_script.ts. Developer level select: src/flow/dev.ts (open the page with #dev or tap the menu title 5 times).
