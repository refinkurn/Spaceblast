# Level progression (Story Mode)

Decided by Refindo, 2026-10-22: the mechanics follow the story journey, and difficulty builds up gradually and logically. Code: `src/sim/levels.ts` (the `LEVELS` table) and `src/sim/constants.ts` (boss timers).

## Principles
- **One new species and one new scenario per sector** (Refindo, 2026-10-22). Each sector teaches one Martian and one hazard, matched to its boss and its story. Earlier ones come back afterwards.
- **One new idea per level.** A new Martian type or hazard arrives on the level whose briefing (Kit's line, `story.ts` CONTEXT) talks about it.
- **Steady growth.** Within a sector, a level never has fewer Martians than the one before. The sector's last normal level is its peak.
- **Bosses keep the pressure on:** no wait between waves is longer than 50 s.

| Sector | New species | New scenario | Boss | Story reason |
|---|---|---|---|---|
| 1 Outpost Surface | Goopling | none (basics) | Goopling Hive | learn on the surface |
| 2 Deep Shafts | Sniffer | Blackout | Darkness Hive | the shafts' power is failing; Sniffers find you by smell |
| 3 Tectonic Core | Phaser | Maze Shift (gate drifts from 3-4) | Maze Master | the crystal cavern reshapes itself, then you meet what moves it |
| 4 Rogue Facility | Builder | Hunt (Ducking's signal) | Ducking duel | his crew fortifies the base; his signal is at full strength |

## Martian types
| Type | Behaviour | First seen |
|---|---|---|
| Goopling (G) | slow, wanders, bites on contact | 1 |
| Sniffer (S) | faster; notices charges and dodges blasts (not always) | 6 |
| Phaser (P) | hides in a burrow (can't be hit), jumps through portals | 11 |
| Builder (B) | slow, toxic to touch, builds rocks next to itself | 16 |

## The 20 levels
| Level | Sector | Martians | Count | Hazards | Kit says |
|---|---|---|---|---|---|
| 1-1 (1) | Outpost Surface | G G | 2 | none | Clear a path through the rocks. (tutorial) |
| 1-2 (2) | | G G G | 3 | none | Small creatures. Keep your distance. |
| 1-3 (3) | | G G G G | 4 | none | More Gooplings. Lure them into your blasts. |
| 1-4 (4) | | G G G G G | 5 | none | The whole herd is out. (sector exam) |
| 1-5 (5) | | **Goopling Hive** | 3 per wave | waves 44 → 22 → 11 s | outlast 3 waves |
| 2-1 (6) | Deep Shafts | G G S | 3 | none | New readings: Sniffers. (first Sniffer) |
| 2-2 (7) | | G G S S | 4 | **Blackout** (first event always a Blackout) | The power down here is failing. |
| 2-3 (8) | | G G S S S | 5 | Blackout | Sniffers hunt by smell. The dark doesn't slow them down. |
| 2-4 (9) | | G G G S S S | 6 | Blackout | Blackouts come more often now. (sector peak) |
| 2-5 (10) | | **Darkness Hive** | 3 per wave + Blackout | waves 40 → 20 → 10 s | outlast 3 waves |
| 3-1 (11) | Tectonic Core | G S S P | 4 | **Maze Shift** | Phasers ahead... And these walls move. (first Phaser) |
| 3-2 (12) | | G S S P P | 5 | Maze Shift | Those walls moved on purpose. |
| 3-3 (13) | | G G S S P P | 6 | Maze Shift + Blackout, events twice as often | Shifts and blackouts together now. |
| 3-4 (14) | | G S S P P P | 6 | same + **Warp Gate drifts** | The gate drifts with the walls. |
| 3-5 (15) | | **Maze Master** | 3 per wave + Maze Shift + cross blast | waves 36 → 18 → 9 s | outlast 3 waves |
| 4-1 (16) | Rogue Facility | G G S P B | 5 | Maze Shift + Blackout + **Martians hunt you** | Builders, fortifying the base. (first Builder) |
| 4-2 (17) | | G S S P P B B | 7 | everything | These attacks aren't random anymore. |
| 4-3 (18) | | G G S S P P B B | 8 | everything | The control room should be close. |
| 4-4 (19) | | G S S S P P P B B | 9 | everything | Last stretch. (the hardest level) |
| 4-5 (20) | | **Ducking** (duel) | 1 rival | Maze Shift only | stun Ducking |

Event timing (unchanged): first event about 20 s in, then every 25-35 s; "twice as often" is every 12-18 s. Every event is announced 3 s ahead. A Blackout lasts 10-15 s; a Maze Shift moves 4-6 rocks.

## What changed from before
- Level 1 has 2 Gooplings instead of 3, so the tutorial isn't crowded. Sector 1 is now 2-3-3-4 (was 3-4-4-5).
- Level 7's first event is always a Blackout, so Kit's "A blackout is next" is true (it used to be random).
- The wandering Warp Gate starts at level 13, where Kit warns about it (was 11).
- Sector 2 rises 4-4-4-6, sector 3 rises 6-6-7-7, and sector 4 rises 7-7-8-9 (was 7-7-8-8), so level 19 is the clear peak.
- Bosses are faster. The first waits are 44, 40 and 36 s (were 60, 48 and 40). Each wait is still half the one before, and none is over 50 s. The fights now last about 77, 70 and 63 s (were 105, 84 and 70).

- 2026-10-22: one species and one scenario per sector (above). Before, all 4 species and both scenarios had arrived by level 8.
