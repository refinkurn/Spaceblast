# Ducking - Sprite Asset Specification

**Project:** Spaceblast
**Character:** Ducking, rogue Astropaw (duck), antagonist. Eyepatch, cape, yellow and black suit.
**Version:** 0.3 (2026-10-31)
**Status:** All poses on the final design. Walk and shocked are placeholders until walk_b and shocked art exists. See QA_REPORT.md.

Follows the same rules as Bosco's spec (hero-astronaut-sprite-spec.md). Differences only:

| Property | Value |
|---|---|
| Frame canvas | 128x128, feet baseline row 123, pivot (64,124) = between the boots |
| Portrait canvas | 128x152, bottom flush |
| Facing | **Right**, same as Bosco. Mirror horizontally at runtime when he faces left (opponent side) |
| Palette | 16 colors: `palette/ducking_palette.hex` (050516 242c32 5a311f 333e44 3f5056 516269 ba692e 7b7d6f c88c30 619aa4 e7973c ebbc3b f8c854 86c3ce a7d8de c7ebf1) |
| Atlas | `atlas/ducking_fullbody_atlas.png` 512x1024, one row per animation, + JSON |
| Portraits | smug, angry, defeated (88x99 art, same density as Kit) |
| Height | 120 px, same as Bosco |
| Attack event | `animations.attack.events.fire` in the atlas JSON: muzzle point for the engine flash |
| Naming | `ducking_<animation>_<NN>.png`, `ducking_portrait_<expression>.png` |

Animations, fps and loop settings are identical to Bosco (in the atlas JSON).

## Revision

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-18 | First pack, 29 files |
| 0.2 | 2026-10-19 | Idle rebuilt from new on-model pose (eyepatch, hazard stripes, light-blue glass). Other animations unchanged |
| 0.3 | 2026-10-31 | All poses and portraits rebuilt from the new design at Bosco height (120 px); new 16-colour palette; attack muzzle event |
