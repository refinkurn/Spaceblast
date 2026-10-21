# Level card + gameplay HUD (compact redesign)

Decided by Refindo, 2026-10-21. UI only: no changes in `src/sim/`, `src/net/`, `server/`.

## Rules that stay
- The level card pauses the game through the existing `cardUp` flag in `main.ts`, the same as now. It never sends a sim command, and Online never shows it.
- The HUD only reads state. Keep the "rebuild only when the string changed" pattern in `src/flow/hud.ts`.
- Respect `env(safe-area-inset-*)` on all four sides. Touch targets stay at least 48 px. No emoji: icons are inline SVG.
- Controls stay as they are: the floating joystick (left gutter) and the Charge button (right gutter). Use the word "Charge", never "Bomb".

## 1. Level card (`#level-card`, `screens.showLevelCard`, `story.levelCard`)
- Compact centred card, about 320×180 (`min(320px, 80vw)`), over a darkened canvas (dim backdrop behind the card).
- Big title: `1-3` style (sector-level within the sector, e.g. level 8 = `2-3`). Boss levels: `1-5 BOSS`.
- Small line under it: the sector name (e.g. `SURFACE`).
- Goal row: one SVG icon + short text:
  - Normal level: gate icon + "Find the Warp Gate".
  - Boss level: shield or clock icon + "Survive 3 waves".
  - Level 20 duel: duel icon + "Stun Ducking".
- Kit's briefing (`CONTEXT`) as one small italic line, with no speaker name. It is hidden when empty.
- Bosco's reply (`REPLIES`) is **no longer shown on the card**. Leave the data in `story.ts`; just stop rendering it.
- "Tap to start" (or "Click to start") pulses at the bottom. The whole screen is the tap target, as now.

## 2. HUD (`#hud`, `hud.ts`, `style.css`)
- **Top-left column:**
  - Avatar badge: 40 px circle using the local astronaut's portrait frame from `astropaw/hero_portrait_atlas`. If that is too fiddly, use a coloured circle with the initial.
  - Next to it: hearts plus oxygen icons.
  - Under that: the power-up pips (charges, range, speed, freeze timer).
  - Under that: the goal text, already in `hud.ts`. Keep it on phones too; shorten it to fit rather than hiding it.
- **Top-centre:** the clock, only when one exists: battle/online round time (`timeLeft`), or the boss wave countdown (`boss.timer`). Normal Story levels show no clock. Also show the stage chip (`BOSS WAVE 2/3`, `Round 2 · You 1–0 Bot`) here, with the clock under it.
- **Top-right:** the Menu, Sound and Full-screen buttons stay as they are.
- Drop the `SPACEBLAST` title text from the HUD.
- **Life-lost feedback:** when the local player's `lives` goes down (compare with the last frame inside `Hud`), the hearts row shakes and flashes red for about 0.4 s. Do the same when `armor` drops. Use CSS animation only, and respect `prefers-reduced-motion`.
- The centre of the arena stays clear. Nothing new sits between the gutters below the top bar.

## Done when
- Level 1, level 5 and level 8 cards show the compact layout with the right goal row. No Bosco line.
- On a 740×360 landscape viewport, the HUD fits with no overlap. The top-left column, top-centre clock (boss and battle only) and top-right buttons don't collide with the gutters.
- Losing a life flashes the hearts.
- `npm test` and `npm run build` pass. Update or add tests in `src/flow/*.test.ts` for the card text, e.g. the `1-3` title and goal per level type.
