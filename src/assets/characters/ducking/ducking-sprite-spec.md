# Ducking - Sprite Asset Specification

**Project:** Spaceblast
**Character:** Ducking, rogue Astropaw (duck), antagonist. Eyepatch, cape, yellow and black suit.
**Version:** 0.2 (2026-10-19)
**Status:** Complete set (26 frames, 3 portraits). Placeholder quality on some frames. See QA_REPORT.md.

Follows the same rules as Bosco's spec (hero-astronaut-sprite-spec.md). Differences only:

| Property | Value |
|---|---|
| Frame canvas | 128x128, feet baseline row 123, pivot (64,124) = between the boots |
| Portrait canvas | 128x152, bottom flush |
| Facing | **Right**, same as Bosco. Mirror horizontally at runtime when he faces left (opponent side) |
| Palette | 14 colors: `palette/ducking_palette.hex` (050516 393c41 1a3f7c 833821 5e696a d6551d 42769b ed9508 d39427 80878c fbd610 8db1c3 f7d146 daedf4) |
| Atlas | `atlas/ducking_fullbody_atlas.png` 512x1024, one row per animation, + JSON |
| Portraits | smug, angry, defeated |
| Naming | `ducking_<animation>_<NN>.png`, `ducking_portrait_<expression>.png` |

Animations, fps and loop settings are identical to Bosco (in the atlas JSON).

## Revision

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-18 | First pack, 29 files |
| 0.2 | 2026-10-19 | Idle rebuilt from new on-model pose (eyepatch, hazard stripes, light-blue glass). Other animations unchanged |
