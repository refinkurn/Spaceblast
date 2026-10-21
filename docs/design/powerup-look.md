# Power-up look (3D pick-ups, HUD icons, effects)

Decided by Refindo on 2026-10-21. This is a view-only change: `src/view/` plus the icons in `src/flow/hud.ts`. No changes to `src/sim/`. Item rules, names and numbers stay exactly as they are.

## Rules that stay
- **Use the game's names.** They are **Extra Charge**, **Beam Range+**, **Speed Boost**, **Oxygen Vest** and **Freeze Pulse**. Never use "bomb", "blast" or "flame" in on-screen text. The art can still look like a charge or a flame.
- There are **5** items, not 4. Freeze Pulse gets a matching look (below).
- **Build everything in code, with no new dependencies.**
  - Use low-poly Three.js geometry, `MeshStandardMaterial` or `MeshToonMaterial`, and inline SVG icons.
  - Share geometry and materials across all copies, as `ItemsView` does now.
  - Add no lights per item.
- **It must run on a 2020 phone.** All item particles go through one shared `THREE.Points` pool, capped at about 120 points. When `AdaptiveQuality` has stepped down, turn off the floor aura and idle particles.

## Colours
| Item | Main | Second | Pick-up mesh | HUD icon |
|---|---|---|---|---|
| Extra Charge | `#00FFFF` neon cyan | `#1A103C` dark indigo | Round low-poly charge, indigo body, glowing cyan star fuse | Cyan charge |
| Beam Range+ | `#FF5500` neon orange | `#FFCC00` yellow | 3-point low-poly flame or energy cluster | Orange 4-way beam burst |
| Speed Boost | `#FFE600` electric yellow | `#FFFFFF` white | Low-poly astronaut boot with small side wings | Yellow boot with 2 motion streaks |
| Oxygen Vest | `#FFFFFF` translucent white | `#7FE8FF` pale cyan rim | Glossy rounded bubble helmet | White O2 tank or shield with a pale cyan glow |
| Freeze Pulse | `#B9A4FF` violet | `#FFFFFF` white | Low-poly ice crystal (octahedron cluster) | Violet snowflake |

Oxygen Vest is **mainly white**, not the brief's `#00FFCC`. That aqua was nearly the same colour as Extra Charge's cyan, so the two would look alike on the grid.

## 1. Pick-ups on the grid (`src/view/actors_view.ts` `ItemsView`)
- **Motion:**
  - Float about 0.3 tiles above the tile centre.
  - Bob on a gentle sine wave (about ±0.05, roughly 1 cycle per 2 s).
  - Spin slowly at 30°/s (`0.52 rad/s`).
  - Keep the per-item phase offset so items don't move in sync.
- **Container:** each item sits in a low-poly glass shell (icosahedron, detail 0 or 1). It is tinted the item's main colour, with `transparent: true`, `opacity: 0.35–0.5` and `depthWrite: false`, so the item inside stays readable.
- **Floor aura:** a flat ring or disc on the tile, in the main colour, with additive blending and a slow pulse. Share one geometry.
- **Idle particles:** a few dots drift upward from the aura in the item's colour, from the shared pool, at about 2 per second per item.
  - Extra Charge: cyan dots.
  - Beam Range+: embers.
  - Others: their main colour.
- **Spawn:** when a rock breaks and an item appears, the item pops in (scale 0 to 1 over about 0.2 s) with a small burst. Reuse `DebrisView.burst`.
- **Collect:** when an item disappears because a player picked it up, a short burst in its colour. Use the existing pick-up event or sound hook. Detecting the item vanishing from the tile is fine too.
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
  - Turn it off at reduced quality.
- **HUD icons:**
  - Replace `POWER_ICONS` (charges, range, speed, freeze) and `OXYGEN` with the new SVG icons in the colours above.
  - Keep the pips (levels 0–5). Don't use "+1" badges, because the HUD shows levels.
  - The same icons appear on the power-up intro cards (`powerup_cards.ts` already uses these constants).

## Done when
- In a dev level with all 5 items revealed:
  - Each item is easy to tell apart on the dark grid.
  - Items bob, spin and glow.
  - Spawn and collect bursts play.
- The vest bubble pulses, and the speed trail shows only while moving.
- HUD and intro card icons match.
- On a throttled phone profile (or after `AdaptiveQuality` steps down), the aura and idle particles turn off and the frame rate holds.
- `npm test` and `npm run build` pass. Add a small test that every `Item` value has a look entry (colours, geometry, icon).
