# Game rules

The rule numbers the game plays by, in one place. **The code is the source of truth**: every number below is quoted from `src/sim/constants.ts`, `src/sim/levels.ts`, `src/services/score.ts` or `src/net/protocol.ts` as of 2026-10-31. Changing a number means changing the code (sim-specialist, with a test) and this file in the same commit.

Origin: the "Martian Blast — Development Plan" doc (Refindo, 2026-10-16). Where the game has moved on from that plan on purpose, the last section says so.

## Arena

- 13 x 11 tiles; 1 tile = 1000 sim units; 60 ticks per second; integers only.
- Pillar layout per arena (`src/sim/arenas.ts`): 0 = classic odd/odd grid; 1-4 = one per Story sector (dunes, corridors, crystal clusters, rooms with doorways). Mirror-symmetric, every tile reachable.
- Rocks fill a share of free tiles: Story stages 1/2/3/4 of each sector 50/55/60/65%, bosses and level 20 60%; Battle uses each arena's own density (dunes 50, mines 60, crystals 55, lab 55, classic 60). Each spawn corner has a 3 x 3 rock-free square.
- The Warp Gate hides under one rock (Story) and opens when that rock breaks.

## Astronauts

- Speed 4 tiles/s; grid movement with corner sliding.
- Start with 1 charge and beam range 1.
- After a knock-out: back in after 1.5 s at the spawn corner (or the nearest free, open tile if a rock or charge took it), with a 1.5 s shield. Power-ups are kept; only armor is lost when it absorbs a hit.

## Plasma Charges

- Fuse 2.5 s. Beam range 1 tile each way, plus Beam Range+.
- A beam is dangerous for 0.5 s, then fades harmlessly for 10 ticks (a beam that looks finished is safe).
- A beam stops at the first pillar or rock; a rock it hits breaks. A beam that reaches another charge sets it off (chain).
- A charge blocks movement, except for its owner until they step off it.

## Power-ups

Every rock rolls once (out of 100). Story: empty 38, Star Dot 30, Extra Charge 8, Beam Range+ 7, Speed Boost 10, Oxygen Vest 5, Freeze Pulse 2. Battle: empty 68, Extra Charge 10, Beam Range+ 7, Speed Boost 10, Oxygen Vest 5 (no Star Dots, no Freeze). The Warp Gate prefers a rock with nothing under it. A beam that hits a revealed power-up destroys it.

**Star Dot** (gem, Story only, `Item.Gem`): +50 score each, picked up on touch. Beams and boss blasts don't destroy it. Not counted in score targets.

| Power-up | Effect | Limit |
|---|---|---|
| Beam Range+ | +1 tile of beam range | 5 |
| Extra Charge | +1 charge on the field at once | 5 |
| Speed Boost (`JetBoots` in code) | +0.54 tiles/s per step | 5 steps (about 6.7 tiles/s) |
| Freeze Pulse | Fires on pickup: every Martian stops for 3 s | single use |
| Oxygen Vest | +1 armor point: absorbs one hit, then a 1.5 s shield | 3 armor |

There is no remote detonator, wall pass or kick.

## Martians

Touching one costs a life (or an armor point). Bite reach: centres closer than 0.65 tile on both axes. Martians spawn at least 6 tiles from any player spawn.

| Martian | Speed | Behaviour | First level |
|---|---|---|---|
| Goopling | 2 tiles/s | wanders, bites on contact | 1 |
| Hungry Goopling (Chaser, pink) | 2 tiles/s | wanders like a Goopling; when an astronaut is within 4 steps of walking path, takes the first step of the shortest path to the nearest one (hunger, not the Hunt) | 3 |
| Sniffer | 3 tiles/s | notices a charge after 0.6 s and steps out of the line; misjudges 1 in 4 | 6 |
| Phaser | 2.4 tiles/s | wanders 5 s, hides 3 s (can't be hit), then opens portals for 4 s (Martians only) | 11 |
| Builder | 1.8 tiles/s | toxic to touch, never chases; places a rock every 4 s, up to 8 | 16 |

From level 16 Martians lean towards the nearest astronaut (the Hunt). Frozen Martians are pale blue.

## Story mode (survival)

- 20 levels in 4 sectors of 5; the full table is `docs/design/level-progression.md`. One new species and one new hazard per sector.
- 3 lives (hearts). Clear a level by finding the Warp Gate and stepping on it; defeating Martians is optional and earns score.
- Levels 5, 10, 15 are bosses (Goopling Hive, Darkness Hive, Maze Master) on the centre tile. They can't be damaged: survive 3 waves; each wait is half the one before (44/40/36 s first waits). Each wave spouts 3 Gooplings.
- Level 20 is a 1-on-1 duel with Ducking (a bot astronaut with 1 life), Maze Shift only.
- Hazards, each announced 3 s ahead, never overlapping; first about 20 s in, then every 25-35 s (12-18 s from level 13):
  - Blackout: lights out for 10-15 s; glows, charges, beams and Martian eyes stay visible.
  - Maze Shift: 4-6 rocks move; never onto an astronaut, Martian, charge, power-up or the gate.
  - Wandering gate (from 14): a revealed gate nobody enters for 10 s flickers 3 s and moves.

## Score and stars (Story)

- Score = 2,000 for a clear + 500 per Martian + 20 per second under par + 1,000 per heart left + 50 per Star Dot.
- Par: stages 1/2/3/4 of every sector 90/80/75/60 s, level 20 60 s; bosses have no par (no time bonus).
- Stars: 1 for a clear, 2 for reaching the level's score target, 3 for every heart left and under par (bosses: every heart left).
- The online leaderboard rejects scores that don't match this formula.

## Battle (vs bots and online)

- 2-4 astronauts, 1 life per round; last one standing wins the round.
- Match: first to 3 round wins vs bots. Online rooms choose first to 3 (default) or best of 3.
- Round clock 2:00 vs bots; online rooms pick 60/90/120/150/180 s. When it runs out, the arena collapses from the edge in a spiral (one block every 0.2 s, announced 3 s ahead), crushing whoever stands there.
- Online rounds open with a 2.4 s 3-2-1-BLAST! hold played by the sim.
- Room options: arena (a sector layout or random), Maze Shift and/or Blackout, bots (Easy/Normal/Hard) in empty seats.

## Changed from the Development Plan (on purpose)

| Plan said | Game does | Why |
|---|---|---|
| Beam Range+ and Extra Charge up to 8; Jet Boots up to 3 | 5 / 5 / 5 steps | readable on a small arena |
| Freeze Pulse 4 s | 3 s | balance |
| Oxygen Vest: immune for 10 s | armor point, up to 3 | clearer on screen, works in battle |
| Level 20 Blaster boss; Martian bosses not in plan | Hive bosses on 5/10/15 (survive 3 waves), Ducking duel on 20 | the story (docs/story/canon.md) |
| Hazards from level 5/8/10 | one hazard per sector (Blackout 7, Maze Shift 11, gate 14, Hunt 16) | Refindo, 2026-10-22 |
| Rocks 55-65% | 50-65% rising per stage (Story) | Refindo's balance brief, 2026-11-03 |
| Hurry Up: arena closes in after 2 min | collapse spiral when the round clock ends | same idea, built |
| Online via WebRTC peer-to-peer | Cloudflare room server sends every tick (ONLINE.md) | reliability, no TURN costs |

Planned but not built yet: the 3-minute level timer with extra Martians, Endless Survival after level 20, same-device 2-player battle, gamepad input, co-op survival. They stay out until ROADMAP.md asks for them.

Balance brief (Refindo, 2026-10-22, built 2026-11-03): drop table with Star Dots, Roamer/Chaser sector 1, par and rock density per stage. Roamer = Goopling, Chaser = Hungry Goopling. The brief's gameplay_config.json was not built: rules stay typed integer constants in src/sim for deterministic online play.
