# Power-up look (3D pick-ups, HUD icons, effects)

Decided by Refindo on 2026-10-21; updated to match the code (src/view/item_look.ts, items_view.ts) on 2026-11-03. This is a view-only change: `src/view/` plus the icons in `src/flow/hud.ts`. No changes to `src/sim/`. Item rules, names and numbers stay exactly as they are.

## Rules that stay
- **Use the game's names.** They are **Extra Charge**, **Beam Range+**, **Speed Boost**, **Oxygen Vest** and **Freeze Pulse**. Never use "bomb", "blast" or "flame" in on-screen text. The art can still look like a charge or a flame.
- There are **5** items, not 4. Freeze Pulse gets a matching look (below).
- **Build everything in code, with no new dependencies.**
  - Use low-poly Three.js geometry, `MeshStandardMaterial` or `MeshToonMaterial`, and inline SVG icons.
  - Share geometry and materials across all copies, as `ItemsView` does now.
  - Add no lights per item.
- **It must run on a 2020 phone.** All item particles go through one shared `THREE.Points` pool, capped at about 120 points, used only for the spawn and pick-up bursts. There is no floor glow and there are no idle particles. When `AdaptiveQuality` has stepped down, the Speed Boost trail turns off.

## Colours
| Item | Main | Second | Pick-up mesh | HUD icon |
|---|---|---|---|---|
| Extra Charge | `#00FFFF` neon cyan | `#1A103C` dark indigo | Low-poly charge (icosahedron), indigo body, glowing cyan fuse | Cyan charge |
| Beam Range+ | `#FF5500` neon orange | `#FFCC00` yellow | Cluster of 4 low-poly flame cones (yellow centre, orange outer) | Orange 4-way beam burst |
| Speed Boost | `#FFE600` electric yellow | `#FFFFFF` white | Yellow hoverboard tilted nose-up, blue lightning bolt on the deck, orange boost flame, cyan pads | Yellow boot with 2 motion streaks |
| Oxygen Vest | `#FFFFFF` translucent white | `#7FE8FF` pale cyan rim | White shield with a pale cyan rim and a cyan cross bar | White O2 tank or shield with a pale cyan glow |
| Freeze Pulse | `#B9A4FF` violet | `#FFFFFF` white | Low-poly ice crystal (octahedron cluster) | Violet snowflake |

Oxygen Vest is **mainly white**, not the brief's `#00FFCC`. That aqua was nearly the same colour as Extra Charge's cyan, so the two would look alike on the grid.

## 1. Pick-ups on the grid (`src/view/actors_view.ts` `ItemsView`)
- **Motion:**
  - Float about 0.3 tiles above the tile centre.
  - Bob on a gentle sine wave (about ±0.05, roughly 1 cycle per 2 s).
  - Spin slowly at 30°/s (`0.52 rad/s`).
  - Keep the per-item phase offset so items don't move in sync.
- **Container:** each power-up sits in a low-poly glass shell (icosahedron, detail 1). The shell is the same pale neutral glass (`SHELL_COLOR`) for every item, with `transparent: true`, `opacity: 0.16` and `depthWrite: false`. Only the item inside carries colour.
- **Size:** the item mesh is drawn 1.3x (`BODY_SCALE`) and the whole item 1.6x (`ITEM_SCALE`), so it reads on a phone.
- **No floor glow:** nothing is drawn on the tile under an item, and there are no idle particles. A glow in the item's colour reads as a second object or a danger tile (playtest, 2026-10-22).
- **Star Dot:** the Star Dot (`Item.Gem`) is a small golden gem with no glass shell. It is not one of the five power-ups.
- **Spawn:** when a rock breaks and an item appears, the item pops in (scale 0 to 1 over 0.2 s) with a small burst from the shared particle pool.
- **Collect:** when an item disappears from its tile, a short burst in its colour (detected by the item vanishing from the grid).
- Hidden items (still under a rock) are not drawn, as now.

## 2. On the player + HUD (`src/view/hero_view.ts`, `src/flow/hud.ts`)
- **Oxygen Vest bubble:**
  - Restyle the existing `bubble` mesh as semi-transparent pale cyan or white (opacity about 0.4), with a gentle scale pulse.
  - Show it while `armor > 0`, as now.
  - Make it slightly brighter with each extra armour point, up to 3.
- **Speed Boost trail:**
  - While a player with `boots > 0` is moving, draw a short fading yellow ribbon behind their feet: a fixed pool of about 8 segments per player, view-only.
  - The trail grows a little with each extra boots level.
  - No trail when standing still.
  - Turned off at reduced quality (`AdaptiveQuality`).
- **HUD icons:**
  - `POWER_ICONS` (charges, range, speed, freeze) and `OXYGEN` in `src/flow/hud.ts` are SVG icons in the colours above (shield, charge with cracks, flame, boot with bolt, snowflake).
  - Keep the pips (levels 0–5). Don't use "+1" badges, because the HUD shows levels.
  - The same icons appear on the power-up intro cards (`powerup_cards.ts` already uses these constants).

## Done when
- In a dev level with all 5 items revealed:
  - Each item is easy to tell apart on the dark grid.
  - Items bob and spin.
  - Spawn and collect bursts play.
- The vest bubble pulses, and the speed trail shows only while moving.
- HUD and intro card icons match.
- After `AdaptiveQuality` steps down, the Speed Boost trail turns off and the frame rate holds.
- `npm test` and `npm run build` pass. Add a small test that every `Item` value has a look entry (colours, geometry, icon).
