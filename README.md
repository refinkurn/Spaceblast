# Spaceblast

Bomberman-style 3D grid battle game: animal astronauts vs hungry Martians.
Phase 1 web prototype — Vite + TypeScript + Three.js.

## Run

```bash
npm install
npm run dev      # open the printed URL; use the Network URL on your phone
npm test         # simulation unit tests
npm run build    # production build in dist/
```

## Controls

- Move: arrow keys / WASD, or drag in the left gutter (floating joystick)
- Charge: Space / X, left mouse click on the arena, or the right button (does nothing until Phase 2)
- New map: R or the New map button

## Deploy

- Game page: Vercel builds every push (`main` = https://spaceblast.vercel.app).
- Online rooms + leaderboard: Cloudflare, `npm run deploy` (pushing doesn't update them).
- Pushing to `main` also runs `.github/workflows/test.yml` (tests + build).

Details in `ONLINE.md`.

See `CLAUDE.md` for the architecture rules.
