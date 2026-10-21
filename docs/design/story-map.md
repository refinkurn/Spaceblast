# Story map (overworld)

Decided by Refindo, 2026-10-21. UI only: `src/flow/`, `index.html`, `style.css`, `src/assets`. No changes in `src/sim/`.

The map replaces the current Story level grid (`#story-hub`, `renderHub()` in `story_mode.ts`).

## Rules
- Progress is read from `StoryProgress` (`src/flow/progress.ts`): `unlocked`, `stars(n)`, `bestScore(n)`, `finished`. Don't read `services/profile.ts`, which is the leaderboard identity only.
- Level data stays in code. Sector names come from `SECTORS` (`story.ts`); boss, rival and roster come from `levelSpec()` (`levels.ts`).
- The new file `src/flow/map_layout.ts` holds **only** the drawing data per sector: node x/y positions in % of the track, and the track theme.
- **Draw it in 2D** with DOM + CSS/SVG and Bosco's 2D sprite (`SpriteView`, `walk` and `neutral` poses). Don't add a second Three.js scene. It must stay light on 2020 phones.
- Respect safe areas on all four sides. Touch targets are at least 48 px. Landscape.
- Canon: Bosco is on foot. Kit is radio only, so she is never drawn on the map. Bosses can't be destroyed.

## 1. Header bar (fixed at the top)
- **Left:** sector title, e.g. `SECTOR 2 · DEEP SHAFTS`. It follows the sector currently centred on screen.
- **Centre:** the **Core signal** gauge. Kit's scanner locks on as Bosco gets closer to the stolen cores.
  - 20 segments; filled = levels cleared (`unlocked - 1`, or 20 once `finished`).
  - Label: `CORE SIGNAL 7/20`.
  - When finished: `CORES RECOVERED`, in full colour.
  - Use an SVG bolt icon, not emoji.
- **Right:** the star counter for the centred sector (`★ 12/15`), then the Leaderboard button (kept from today) and Back (48 px).

## 2. The track
- One horizontal scrolling strip with all 4 sectors side by side. Each sector is about one screen wide, has its own backdrop, and has a short gap or "warp" divider between it and the next.
- **Sector backdrops**, using CSS gradients and simple shapes, no big images:
  - **1 Outpost Surface:** red dusty surface under a dark sky, the crashed Biscuit at the start, a dirt trail.
  - **2 Deep Shafts:** rusty mine-cart rails in dark red caverns, old support beams. This is the first underground sector.
  - **3 Tectonic Core:** cracked rock with lava-orange glow lines.
  - **4 Rogue Facility:** metal walkways patched with green-violet alien biotech. A few wrecked ship hulls sit in the background (the ship graveyard, left unexplained).
- **Nodes:** 5 per sector, joined by the trail.
  - **Level node:** a round chamber marker with the level's `1-3` style number. Up to 3 stars sit above it (gold earned, dim not earned), and a small Warp Gate glyph beside it.
  - **Boss node:** the last one in each sector (levels 5, 10 and 15; level 20 is the Ducking duel). It is bigger, with a red or gold ring and the boss name underneath: Goopling Hive, Darkness Hive, Maze Master, Ducking.
  - **States:**
    - Locked: dim, with a padlock, and taps are ignored.
    - Current (the highest unlocked level): a pulsing ring.
    - Cleared: stars shown.
- **No bonus nodes for now.** Leave room in the layout for branches later.
- **Bosco pawn:** the 2D sprite stands on the current node in the `neutral` pose. While moving it plays the `walk` pose and is flipped to face the direction of travel.

## 3. Scrolling
- Horizontal drag or swipe with momentum. Use native `overflow-x: auto` with `scroll-snap` per sector, plus mouse-wheel support on desktop. Arrow keys move between nodes.
- Scrolling is allowed up to the end of the sector **after** the current one. That next sector is drawn dim and locked so players can see what's coming. Sectors beyond that are cut off.
- On open, the map scrolls straight to the current node, with no animation.

## 4. Node card (replaces the level card when starting from the map)
Tapping an unlocked node opens the compact card: the same look as the level card from `docs/design/hud-intro.md`, using `levelCard()` for the text. It shows:
- The title (`2-3`, or `1-5 BOSS`) and the sector name.
- The goal row from `levelCard()`: "Find the Warp Gate · 4 Martians", "Survive 3 waves", or "Stun Ducking". Martian counts come from `levelRoster(n).length`.
- Kit's one-line briefing.
- **The 3-star checklist,** each line ticked if that star is earned on this level:
  1. Clear the level.
  2. Reach `scoreTarget(n)` points, written out, e.g. "Score 6,375".
  3. Keep all 3 hearts and finish under par (`parSeconds(n)` s). Boss levels: keep all 3 hearts.
- "Best: 8,540" when there is a best score.
- **ENTER TUNNEL** (or **ENTER** on Sector 1, which is above ground) as the primary button, at least 48 px tall. Tapping outside the card or pressing Back closes it.

Entering from the node card plays the level's intro cutscene if it has one, then goes **straight into play**. The countdown runs if it is built; there is no second level card. Moving on with "Next level" from the end-of-level screen still shows the normal level card.

## 5. Moving along and the sector warp
- **Map after a clear:** after a clear, the "Main menu" exit from the end-of-level screen goes back to the map instead of the main menu. Bosco walks from the cleared node to the next one along the trail (about 0.6 s), and the next node unlocks with a pop.
- **Boss cleared** (levels 5, 10, 15):
  - The map plays a neon portal warp: a full-screen cyan-violet swirl over about 0.8 s, CSS only.
  - It scrolls to the next sector, and Bosco appears at its first node.
  - The divider between the two sectors lights up.
- Use `prefers-reduced-motion` for a simple fade instead of the walk and the swirl.

## Done when
- Story Mode opens the map. All 20 levels show in 4 themed sectors, with one boss or duel node at the end of each sector.
- Locked, current and cleared states and stars are correct.
- Scrolling stops one sector past the current one.
- The node card shows the checklist with earned stars ticked, and Enter goes straight to play.
- The walk and warp animations play after a clear.
- Everything fits a 740×360 landscape viewport with safe areas.
- `npm test` and `npm run build` pass. Add tests for the map-layout data (every level 1–20 has a node, and boss nodes match `levelSpec`) and for the checklist text.
