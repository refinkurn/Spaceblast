# Design system

One place for how Spaceblast looks and feels. Feature specs in `docs/design/` link here instead of repeating it. When a colour, size or style below changes in code, update this file in the same commit. Values are taken from the code on 2026-10-31; the code files named here hold the real values.

## Vibe

- **Retro arcade, playful, with a noir villain.** Old-Nintendo pixel characters in 2D scenes; clean low-poly 3D in the arena. Family-friendly: no blood, no on-screen deaths ("knocked out", "captured").
- **Spaceship console UI.** Dark panels, thin edges, one cyan accent. Screens feel like Bosco's cockpit, not a web page.
- **Readable at a glance on a phone held sideways.** Gameplay colours are reserved (below) so a beam or a Martian never blends into the floor.
- Tone of text: short and warm. Kit is calm and dry (radio only), Bosco eager, Ducking smug.

## Colour

### Interface (`src/style.css` `:root`)
| Token | Value | Use |
|---|---|---|
| page background | `#14161d` | behind everything |
| `--ink` | `#e8ecf5` | main text |
| `--ink-quiet` | `#9aa3b5` | secondary text, hints |
| `--accent` | `#5ad1ff` | the one highlight colour: lit buttons, focus, the plasma |
| `--dash-bg` / hover | `#06080cf0` / `#0c1a24f2` | every button and panel |
| `--dash-edge` | `#ffffff2e` | 1 px panel edge |
| `--dash-radius` | `6px` | corners |
| `--dash-lit` | accent edge + soft inner glow | the screen's main action (never a solid fill) |

### Gameplay colours are reserved (`src/view/play_colors.ts`)
Plasma `#5ad1ff`, beam core `#e9fbff`, Goopling `#6fd14f`, Sniffer `#a66bff`, Phaser `#7f8cff`, Builder `#c6e33a`, frozen `#9fd8ff`, Maze Shift remove `#ff4fd8` / add `#ffe25a`, open gate `#7dffd8`. **No floor, rock, prop or UI background may look like these**; `sector_look.test.ts` fails if one does.

### Players (`src/net/protocol.ts` `PLAYER_COLORS`)
Blue `#3a7bff` (P1, Bosco), orange `#ff6a3d`, green `#4fd17a`, violet `#c77dff`, pink `#ff5fa2`, yellow `#ffd23f`, teal `#3fd8e0`, white `#e8ecf5`. The suit takes the colour; the helmet and backpack stay neutral.

### Sectors (`src/config/sectors.json`)
| Sector | Feel | Map ground | Arena floor |
|---|---|---|---|
| 1 Duststorm Valley | rust dunes, landing gear, solar panels | `#C84B31` | `#8F4632` checker, sand rocks |
| 2 Abandoned Mining Colony | dim steel shafts, floodlights | `#2D3748` | `#3d4a60`, soft rust rocks |
| 3 Crystal Core | dark slate cavern, amber crystals | `#2A085C` | `#1D2C38`, amber crystal rocks |
| 4 Underground Bio-Lab | cold steel lab, vats, alarm bars | `#94a3b8` | `#5D6878`, tan crates |
Story map nodes: sector 1 green, 2 blue, 3 violet, 4 magenta, bosses red, the duel gold.

## Type

- **Decided (Refindo, 2026-10-31): arcade, but galactic, not retro.** Two free faces (SIL Open Font Licence), bundled with the build so the game works offline (never loaded from Google at runtime):
  - **Russo One** (`--font-display`): the big moments only. Logo and title, level card number (`1-3`), end-of-match title (VICTORY!, LEVEL CLEAR), story and section headings. One weight, so it is never used for small text.
  - **Chakra Petch 700, some 500** (`--font-label`): the ship-console voice. HUD clock, score and stage chip, menu and dashboard buttons, card labels, dialogue speaker names, lobby seats, settings values, uppercase labels with ~0.06-0.14em letter-spacing.
  - **System font** (`--font-body`): body text, Kit's dialogue lines, tips, descriptions, long sentences. `system-ui, -apple-system, 'Segoe UI', sans-serif`.
  - Every face keeps a fallback stack ending in the system font. Numbers that line up (clock, score, stats) use `font-variant-numeric: tabular-nums`.
  - Preview of the choice: the "Spaceblast Font Lab" artifact. Rejected: Death Star (personal-use licence, Star Wars look), Orbitron (overused, too wide), Audiowide (reads 80s).
- Sizes: dialogue text 16-20 px, names 13 px, HUD scales with `--hs`. Titles use `clamp()` so they fit 568 px-wide phones.

## Components

- **Dashboard button:** `--dash-*` panel, icon + label, at least 48 x 48 px. One proceed icon (`#i-play`) and one back icon (`#i-back`) from the SVG sprite in `index.html`; Back is always pinned top-left (`.nav-back`).
- **Cards** (Settings, How to Play, pause, level card, end of match): one centred panel over a dim backdrop; tap outside = Back.
- **Selector:** one `‹ value ›` stepper (`src/flow/stepper.ts`) for every option.
- **HUD:** top-left stats panel (avatar, hearts, armor, one power-up per row, goal); top-centre stage chip and clock (boss and battle only); top-right Sound / Pause / Full screen. Touch: joystick in the left gutter, CHARGE button in the right.
- **Dialogue:** slim full-width bottom banner, 64 px portrait (none on narration), sprite stands above it, Skip top-right.
- **Kit radio toast:** short line under the HUD, queue of 3, never over a card.
- **Transitions:** 100 ms to black, 150 ms back (`src/flow/transition.ts`) between screens.
- **Icons:** inline SVG, flat colours, each power-up in its own colour with level pips.

## Characters

### 2D (scenes, portraits, menu) — rules in `src/assets/characters/README.md`
- Full-body cell 128 x 128, pivot (64,124), feet on row 123. Portrait cell 128 x 152, pivot (64,152).
- **One height standard:** every full-body character fills about 78% of the source image and stands about 120 px tall in the cell, like Bosco (Refindo, 2026-10-31). Smaller only as a deliberate design choice.
- **One pixel density** for all portraits (Bosco's and Kit's). Palette about 16 colours per character, indexed PNG.
- Nearest-neighbour scaling, whole multiples only, no mipmaps. Everyone faces right; mirror for left.

### 3D (arena) — `src/view/astronaut_mesh.ts`, `martian_*`, `docs/design/character-animation.md`
- Low-poly built in code, shared geometry, about 0.9 tile tall, no textures; flat or Lambert colours.
- Animation is procedural: breathing, run lean, 120 ms charge squash, 200 ms hurt flash.

### Canon looks (2D and 3D must agree)
| Character | Look |
|---|---|
| Bosco | corgi, blue suit, light-blue glass helmet, orange-and-white ray blaster |
| Ducking | duck, dark grey feathers, black eyepatch, black cape, yellow suit with black-and-yellow hazard stripes, chevron "V" emblem, orange boots, light-blue glass helmet |
| Captain Kit | old sphynx cat, wrinkled, big ears, yellow almond eyes, purple commander uniform with gold trim; radio only, portraits only |
| Martians | colours are the reserved gameplay colours above |

The 3D Ducking is still violet with a yellow head; fixing it is queued in HANDOFF.

## Motion and feel

- Juice is short: shakes under 0.25 s, flashes 200 ms, beeps under 1.5 s. Screen shake is off by default with reduced motion.
- Everything heavy has a lighter mode: `AdaptiveQuality` drops particles, trails and shadows on slow phones.

## Feature specs (details live there)

`character-animation`, `hud-intro`, `leaderboard`, `level-progression`, `martian-look`, `match-screens`, `menu-dialogue`, `polish-settings-net`, `powerup-look` (its floor aura was later removed), `radio-juice`, `story-map`.
