# Spaceblast

Bomberman-style 3D grid battle game: Bosco the corgi Astropaw, stranded on forbidden Mars, blasts through Martian hives to catch the rogue duck Ducking. 20-level Story mode, Battle vs bots, and online rooms for 2-4 players.

Vite + TypeScript + Three.js, web first (phone browsers, landscape). Play: https://spaceblast.vercel.app

## Run

```bash
npm install
npm run dev      # open the printed URL; use the Network URL on your phone
npm test         # unit tests (must pass before every commit)
npm run build    # typecheck + production build in dist/
```

## Controls

- Move: arrow keys / WASD, or the joystick in the left side of the screen (floating or fixed, in Settings)
- Charge: Space / X, left mouse click on the arena, or the CHARGE button on the right
- Pause: P / Escape, or the pause button top-right

## Deploy

- Game page: Vercel builds every push (`main` = https://spaceblast.vercel.app).
- Online rooms + leaderboard: Cloudflare, `npm run deploy` (pushing doesn't update them).
- Pushing to `main` also runs `.github/workflows/test.yml` (tests + build).

Details in `ONLINE.md`.

## Docs

| File | What |
|---|---|
| `CLAUDE.md` | architecture and coding rules (read by every agent) |
| `docs/ROADMAP.md` | vision, players, milestones, monetisation |
| `docs/GAME_RULES.md` | every rule number the game plays by |
| `docs/DESIGN.md` | colours, type, components, character art rules |
| `docs/HANDOFF.md` | the work queue: Ready, In progress, Blocked, Known issues, Done |
| `docs/PLAYBOOK.md` | who does what, and how to ask for work |
| `docs/story/canon.md` | the story bible |
| `docs/design/` | feature specs |
| `ONLINE.md` | hosting and the online room server |
