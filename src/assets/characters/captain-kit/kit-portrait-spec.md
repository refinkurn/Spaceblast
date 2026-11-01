# Captain Kit - Portrait Asset Specification

**Project:** Spaceblast
**Asset:** Captain Kit, old sphynx cat, captain of Biscuit
**Version:** 0.2 (2026-10-31)
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
18 colors, `palette/kit_palette.hex` and `.gpl` (v0.2 added #51330d and #adaeac for the headset and sweat drop). Outline #050516 is shared with Bosco and Ducking.
Key colors: sphynx skin greys and peaches, gold eyes and trim (#F0C149, #D99C24), purple jacket (#4F2675, #2E0C4E).

## Portraits
| File | Use |
|---|---|
| kit_portrait_neutral | Default dialogue, briefings |
| kit_portrait_stern | Orders, warnings, the prologue refusal |
| kit_portrait_worried | Danger, distress calls |
| kit_portrait_relieved | Mission success, Bosco safe |

## Known issues (v0.2)
- Worried and relieved show a small radio headset by the ear; neutral and stern don't have one. At 1x it is only a few grey pixels.
- Wrinkle lines are dense; they read as texture at 1x.

## Revision
| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-19 | First 4 portraits |
| 0.2 | 2026-10-31 | Worried (almond eyes, sweat drop) and relieved (both eyes closed, soft smile) redrawn; palette 16 -> 18 colors |
