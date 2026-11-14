# Spaceblast — project rules

Bomberman-style 3D grid battle game: animal astronauts vs hungry Martians.
Web first (Vite + TypeScript + Three.js), wrapped for Android/iOS later with
Capacitor. Multiplayer is the main goal, so the simulation must stay deterministic.

## Commands

- `npm run dev` — dev server (also reachable from a phone on the same Wi-Fi)
- `npm test` — Vitest unit tests (must pass before every commit)
- `npm run build` — typecheck + production build into `dist/`
- `npm run status` — queue, phone checks waiting, long files (no agent needed); `npm run check` — tests + build + portal build; `npm run shots` — phone/desktop screenshots with checks (shots/); `npm run live` — the live page and server answer and run the same build; `npm run online-check` — two browsers join a room and play a round (run after any src/net, server or main-loop change)
- Listing pack (docs/LISTING.md): `node scripts/listing_covers.mjs` (covers from the menu art), `node scripts/listing_capture.mjs` + ffmpeg (gameplay videos, slow: about 30 min each)
- `npm run build:portal` — CrazyGames build: `dist-portal/` + `spaceblast-portal.zip` (rules and what it switches off: docs/PORTAL.md)
- Hosting (ONLINE.md): game page on Vercel (https://spaceblast.vercel.app, built on every push: `main` = live), rooms + leaderboard on Cloudflare (https://spaceblast.refinkurn.workers.dev)
- Every push to `main` deploys both: Vercel builds the page, Cloudflare Workers Builds deploys the rooms + leaderboard (a deploy restarts live rooms)
- `npm run deploy` — deploy the rooms + leaderboard (and a page copy) to Cloudflare by hand
- `npm run deploy:fly` — Fly.io room server, Singapore, one machine: ready but not deployed (not free; see ONLINE.md)

## Architecture (do not break these)

```
src/
  sim/     game rules: plain TypeScript, deterministic, no DOM, no Three.js
  input/   devices -> PlayerCommand (keyboard, touch, bots)
  net/     online rooms: protocol, server frames (frames.ts), connection + reconnect (link.ts)
  view/    Three.js rendering; reads sim state, never writes it (plus 2D character sprites: sprite_loader.ts, sprite_renderer.ts)
  assets/   art as data: characters/<id>/character.json + atlases (README.md there); menu/menu.json + key art
  audio/   synthesised sound effects and music (Web Audio, no files); driven by sim events
  flow/    menus, HUD, story, online lobby
  services/ score rules, leaderboard client + offline queue, device profile, name filter (docs/design/leaderboard.md)
  config/  data: locales.json (interface text by key; English now); portal.ts (portal builds: what is switched off)
  utils/   i18n.ts: t(key, vars) for interface text; applyDom() fills data-i18n labels in index.html
  main.ts  wiring + fixed 60 Hz loop (shared run state: flow/session.ts; rounds: flow/game_run.ts, battle_flow.ts, online_play.ts; sim events: flow/event_handlers.ts; sizing: flow/screen_layout.ts)
server/    the room server: room.ts (shared: seats, rejoin, one build version per room), round_clock.ts (round ticks + frames), room_join.ts (join requests, tokens), build_version.ts (commit SHA as the build version), leaderboard.ts (scores API), node_host.ts (Node hosting for dev + Fly), node_sqlite.ts, dev_relay.ts (npm run dev), fly.ts (Fly.io; Dockerfile, fly.toml, npm run build:server), worker.ts (Cloudflare), offline_cache.ts (build step: writes sw.js so the installed game opens offline; registered by src/flow/offline.ts)
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
- Interface text (menus, HUD, buttons, alerts, Kit's radio toasts) goes through t('key') with the words in src/config/locales.json; static labels in index.html carry data-i18n. The story script stays in story.ts / story_scenes.ts / tutorial_script.ts.

## Workflow

- Start every session by reading `docs/HANDOFF.md` (where to put what: `docs/PLAYBOOK.md`); take the top Ready item, update the file when done.
- Specs from the story/design chat live in `docs/story/` and `docs/design/`. The code stays the source of truth for what plays.
- Delegate by cost: story text → `script-integrator` (Haiku), checks before commit → `qa-runner` (Haiku, runs the scripts above), UI / input / CSS / assets → `ui-builder` (Sonnet), `src/sim/` / `src/net/` / `server/` → `sim-specialist` (Opus). Prefer a script over an agent, and an agent over reading many files in the main session.
- GitHub Actions runs the tests, builds, the screenshot checks (test.yml) and, after each deploy and every morning, the live check (live.yml). A red run is the first thing to fix.
- Commit straight to `main` once `npm test` passes.

## Game rules reference

Rule numbers: `docs/GAME_RULES.md` (arena, charges, power-ups, Martians, Story, score, Battle); it quotes the code, so a rule change updates the code and that file together. Look and feel (colours, type, components, character rules): `docs/DESIGN.md`. Vision and milestones: `docs/ROADMAP.md`.

Where things live: level and boss data src/sim/levels.ts and src/sim/boss.ts; arenas src/sim/arenas.ts; story text src/flow/story.ts, cutscene scripts src/flow/story_scenes.ts, tutorial steps and tips src/flow/tutorial_script.ts. Menu: src/flow/menu.ts; 2D story scenes: src/flow/cutscene.ts (shots take a `pose`). Developer level select: src/flow/dev.ts (open the page with #dev or tap the menu title 5 times).
