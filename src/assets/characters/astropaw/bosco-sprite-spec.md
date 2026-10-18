# Hero Astronaut (Corgi) - Sprite Asset Specification

**Project:** Spaceblast
**Asset:** Bosco, hero Astropaw (corgi)
**Status:** Grid and palette locked from the first frame of each pose (9 frames converted). Remaining animation frames still to be supplied.
**Version:** 0.5

---

## 1. Overview

Animal astronaut character (corgi) in a blue suit and glass helmet. Used in:

- Main menu (static, right side)
- 2D cinematic pop-ups (left side, dialogue below)
- In-game battle mode and Story Mode

Visual style: old Nintendo-era pixel art. Hard pixel edges, no anti-aliasing, limited palette, consistent black outline.

---

## 2. Canvas and Pixel Grid

| Property | Value |
|---|---|
| Logical pixel grid (full-body frame) | 128x128 canvas. Source art is natively about 98 logical px tall, so 32x32 / 48x48 would have destroyed detail. |
| Portrait grid | 128x152 (bust, bottom edge flush by design). Note: portrait is about 2x the pixel density of the sprite head. See Open Items. |
| Display scale | Integer multiples only (2x, 3x, 4x) |
| Pivot / anchor | (64, 124): bottom-center of feet, shared across all frames. Feet baseline = row 123 |
| Frame padding | At least 2 logical pixels transparent on all sides (portrait bottom exempt) |

Use one pixel grid for all full-body frames. Do not mix pixel densities across poses or portraits.

---

## 3. Palette

Locked from the converted frames. Full 16-color palette is in `palette/hero_palette.hex` and `.gpl`. Extra colors in the file: #130F38 (deep blue), #91261D (dark red shadow), #6A727F (grey shadow), #C85278 (pink shadow), #E4A17E (muzzle shadow).

| Role | Hex | Notes |
|---|---|---|
| Outline | #050516 | Near-black, used for all outlines |
| Corgi fur (main) | #FA8620 | Orange |
| Corgi muzzle / ear inner | #FEE7C2 | Cream |
| Corgi shadow | #CD5324 | Darker orange, for shading |
| Suit (main) | #0B6DAF | Mid blue |
| Suit (shadow) | #1B3C7F | Darker blue |
| Suit (highlight) | #429DD3 | Lighter blue |
| Helmet rim | #A2A9B3 | Silver / grey |
| Helmet glass highlight | #A3C5DE | Pale blue |
| Chest badge | #F588B3 | Pink |
| Sneakers (accent) | #FA8620 + #EBF1F5 | Orange with white |
| Eyes / nose | #050516 + #EBF1F5 | Black with white highlight |

Total: 16 colors including outline. Effects (sparkles, gun flash) use palette colors, so the yellow in the concept art became orange/cream.

---

## 4. Animations

| Animation | Frames | Suggested FPS | Loop | Notes |
|---|---|---|---|---|
| Idle | 4 | 6 | Yes | Subtle breathing or bob |
| Walk | 4 | 10 | Yes | Exaggerate stride for readability |
| Attack | 4 | 12 | No | Arm extends, motion arc on final frame |
| Shocked | 2 | 8 | No | Hold last frame |
| Angry | 2 | 8 | No | Brows must read at small size |
| Hit / Hurt | 2 | 12 | No | Stars or impact marks on frame 2 |
| KO | 4 | 8 | No | Rotation sequence, hold final frame |
| Victory | 4 | 8 | Yes | Arms up, cheer |

Portraits (static, not animated):

| Portrait | Expression |
|---|---|
| Portrait - Neutral | Default dialogue |
| Portrait - Shocked | Dialogue reactions |
| Portrait - Happy | Victory and positive beats |

---

## 5. File Format and Export

- **Format:** PNG-24 with alpha, transparent background
- **Atlas:** One sprite sheet per animation set, frames in a single row per animation
- **Sheet layout:** Fixed frame size, no padding gaps unless required by the engine
- **Data file:** JSON atlas with frame name, x, y, width, height, pivot
- **Color profile:** None embedded (sRGB)
- **Compression:** Lossless only

---

## 6. Naming Convention

Pattern: `hero_<animation>_<frame>.png`

Examples:

- `hero_idle_01.png`
- `hero_walk_03.png`
- `hero_attack_04.png`
- `hero_portrait_neutral.png`

Keep names lowercase, underscore-separated, no spaces.

---

## 7. Memory Budget

Target memory-friendly for 2020+ phones.

| Item | Budget |
|---|---|
| Full character atlas (all animations) | TBD (set after frame count and grid are final) |
| Portrait atlas | TBD |
| Max texture dimension | 1024 px per atlas (proposed; 512 does not fit the full 26 frames at 128x128) |

---

## 8. QA Checklist

Before handoff, every frame must pass:

- [ ] Uses only palette colors listed above
- [ ] Hard pixel edges, no anti-aliasing or blur
- [ ] Outline is consistent weight across all frames
- [ ] Feet sit on the shared baseline
- [ ] No pixels outside the frame padding
- [ ] Transparent background, no baked-in backgrounds
- [ ] Face and helmet readable at 2x display scale
- [ ] Shocked, angry, and hit expressions readable at small size
- [ ] Portraits match the full-body character design
- [ ] Walk cycle shows clear leg movement between frames
- [ ] Filenames follow the naming convention

---

## 9. Open Items

1. Portrait density (about 2x the sprite head): redraw at sprite density, or accept as a deliberate hi-res portrait
2. Confirm 1024 px max texture
3. Whether the helmet visor stays dark or shows the face more clearly
4. Simplified arm and hand shapes (current frames still show mass)
5. Frame counts confirmed per animation
6. Cleanup pass on helmet edges and KO rotation frames
7. Redraw portraits to match full-body proportions

---

## 10. Revision History

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-18 | Initial spec from mockup sprite sheet |
| 0.2 | 2026-10-18 | Grid, pivot and 16-color palette locked from 9 converted frames |
| 0.3 | 2026-10-18 | Idle, shocked, angry, hit animations completed procedurally; atlas is one row per animation (512x1024) |
| 0.4 | 2026-10-18 | All 26 frames and 3 portraits present. Walk, attack, KO, victory frames 2-4 and shocked/happy portraits are code-built placeholders |
| 0.5 | 2026-10-19 | Rebuilt from batch-2 art (scarf, ray blaster, light-blue glass). Art fitted to 120 px tall. Full frame counts; in-betweens procedural |
