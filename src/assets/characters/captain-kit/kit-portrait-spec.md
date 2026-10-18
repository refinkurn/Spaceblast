# Captain Kit - Portrait Asset Specification

**Project:** Spaceblast
**Asset:** Captain Kit, old sphynx cat, captain of Biscuit
**Version:** 0.1 (2026-10-19)
**Status:** Portrait-only. Kit speaks by radio, so there are no full-body frames.

## Use
- 2D cinematic pop-ups (character left, dialogue bottom)
- Tutorial, alien and power-up cards (Kit's voice)
- Radio briefings

## Canvas
| Property | Value |
|---|---|
| Portrait canvas | 128 x 152, bust cut flush at the bottom edge |
| Pivot | (64, 152), bottom-center |
| Pixel pitch at source | 10.23 px (same as Bosco's portraits) |
| Padding | At least 2 px left, right and top |
| Facing | Right (3/4 view). Mirror at runtime if he must face left |

## Palette
16 colors, `palette/kit_palette.hex` and `.gpl`. Outline #050516 is shared with Bosco and Ducking.
Key colors: sphynx skin greys and peaches, gold eyes and trim (#F0C149, #D99C24), purple jacket (#4F2675, #2E0C4E).

## Portraits
| File | Use |
|---|---|
| kit_portrait_neutral | Default dialogue, briefings |
| kit_portrait_stern | Orders, warnings, the prologue refusal |
| kit_portrait_worried | Danger, distress calls |
| kit_portrait_relieved | Mission success, Bosco safe |

## Known issues (accepted for v0.1)
- Worried has round eyes, unlike the almond eyes of the other three, and no sweat drop.
- Relieved reads closer to a wink than a smile.
- Wrinkle lines are dense; they read as texture at 1x.
