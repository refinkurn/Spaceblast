import { BossKind, Kind, RIVAL_PAR_SECONDS, ROCK_DENSITY_PERCENT, STAGE_PAR_SECONDS, STAGE_ROCK_DENSITY } from './constants';
import type { GameOptions } from './state';

// Survival ("story mode"): 20 levels in 4 sectors of 5. The 5th level of
// each sector is a boss: survival waves on 5, 10 and 15, a duel on 20.
//
// The table below follows the story pacing: each sector brings exactly one
// new Martian species and one new scenario (hazard), introduced by Kit's
// briefing, with the Martian count rising steadily inside each sector.
//
//   Sector 1  Duststorm Valley         (1-5)   new: Gooplings, then hungry Gooplings (Chasers, 3); no hazards
//   Sector 2  Abandoned Mining Colony  (6-10)  new: Sniffers (6), Blackout (7)
//   Sector 3  Crystal Core             (11-15) new: Phasers + Maze Shift (11); Blackout returns (13), gate drifts (14)
//   Sector 4  Underground Bio-Lab      (16-20) new: Builders + the Hunt (16); then every hazard together
//
// Each sector also has its own arena layout (arenas.ts, id = sector number).

export const LEVEL_COUNT = 20;

/** Which level events are switched on. */
export interface LevelRules {
  mazeShift: boolean;
  gateWander: boolean;
  blackout: boolean;
  /** Events every 12-18 s instead of 25-35 s. */
  frequentEvents: boolean;
  /** Martians lean towards the nearest astronaut when they pick a direction. */
  aggressive: boolean;
  /** The level's first event is a Blackout (Kit warns about it in the briefing); later ones alternate as usual. */
  blackoutFirst: boolean;
}

export const NO_EVENTS: LevelRules = { mazeShift: false, gateWander: false, blackout: false, frequentEvents: false, aggressive: false, blackoutFirst: false };

export interface LevelSpec {
  level: number;
  sector: number;
  roster: Kind[];
  rules: LevelRules;
  boss: BossKind;
  /** Level 20: a 1v1 duel against the Renegade Pilot (a bot astronaut). */
  rival: boolean;
  /** Arena layout (arenas.ts): each sector has its own, so this is the sector number. */
  arena: number;
  /** Stage in the sector, 1-5 (5 = the boss, or the duel on level 20). */
  stage: number;
  /** Par in seconds for the score's time bonus; null on boss levels. */
  par: number | null;
  /** Chance (in %) that a floor tile starts as a rock (GameOptions.rockDensity). */
  rockDensity: number;
}

const { Goopling: G, Sniffer: S, Phaser: P, Builder: B, Chaser: C } = Kind;

const MAZE: Partial<LevelRules> = { mazeShift: true };
const DARK: Partial<LevelRules> = { blackout: true };
const CORE: Partial<LevelRules> = { mazeShift: true, blackout: true, frequentEvents: true };
const DRIFT: Partial<LevelRules> = { ...CORE, gateWander: true };
const STALK: Partial<LevelRules> = { mazeShift: true, blackout: true, aggressive: true };
const HUNT: Partial<LevelRules> = { ...DRIFT, aggressive: true };

/**
 * Per level: the Martians (boss levels bring their own) and the hazards.
 * The comment is the level's intent (Kit's briefing in story.ts matches it).
 */
const LEVELS: { roster: Kind[]; rules?: Partial<LevelRules> }[] = [
  // Sector 1: Duststorm Valley. Gooplings only, no hazards: learn the basics.
  { roster: [G, G] }, //                         1  tutorial: two slow Gooplings
  { roster: [G, G, G] }, //                      2  more Gooplings
  { roster: [G, G, C, C] }, //                   3  first hungry Gooplings (Chasers)
  { roster: [C, C, C, C] }, //                   4  the sector's peak: all hungry
  { roster: [] }, //                             5  Goopling Hive
  // Sector 2: Abandoned Mining Colony. New: Sniffers, then Blackouts (the only hazard here).
  { roster: [G, G, S] }, //                      6  first Sniffer; no hazards yet
  { roster: [G, G, S, S], rules: { ...DARK, blackoutFirst: true } }, // 7  first Blackout (Kit warns: it comes first)
  { roster: [G, G, S, S, S], rules: DARK }, //   8  Blackouts, more Sniffers
  { roster: [G, G, G, S, S, S], rules: DARK }, // 9  the sector's peak
  { roster: [] }, //                             10 Darkness Hive
  // Sector 3: Crystal Core. New: Phasers and Maze Shift; then old hazards return.
  { roster: [G, S, S, P], rules: MAZE }, //      11 first Phaser, first Maze Shift
  { roster: [G, S, S, P, P], rules: MAZE }, //   12 more Phasers, walls keep moving
  { roster: [G, G, S, S, P, P], rules: CORE }, //   13 Blackout returns, events twice as often
  { roster: [G, S, S, P, P, P], rules: DRIFT }, //  14 the gate starts to wander
  { roster: [] }, //                             15 Maze Master
  // Sector 4: Underground Bio-Lab. New: Builders and the Hunt; then every hazard.
  { roster: [G, G, S, P, B], rules: STALK }, //            16 first Builder, Martians start hunting
  { roster: [G, S, S, P, P, B, B], rules: HUNT }, //       17 full Hunt: every hazard
  { roster: [G, G, S, S, P, P, B, B], rules: HUNT }, //    18 full Hunt
  { roster: [G, S, S, S, P, P, P, B, B], rules: HUNT }, // 19 the hardest level
  { roster: [], rules: MAZE }, //                20 the duel with Ducking: Maze Shift only
];

const BOSSES: Record<number, BossKind> = { 5: BossKind.GooplingHive, 10: BossKind.DarknessHive, 15: BossKind.MazeMaster };

function rulesFor(level: number): LevelRules {
  if (BOSSES[level]) return NO_EVENTS; // the boss drives its own hazards
  return { ...NO_EVENTS, ...LEVELS[level - 1].rules };
}

export function sectorOf(level: number): number {
  return Math.min(4, Math.ceil(Math.max(1, Math.min(level, LEVEL_COUNT)) / 5));
}

export function levelSpec(level: number): LevelSpec {
  const n = Math.max(1, Math.min(level, LEVEL_COUNT));
  const stage = n - (sectorOf(n) - 1) * 5;
  const boss = BOSSES[n] ?? BossKind.None;
  // Stages 1-4 get par 90/80/75/60 s and rocks 50/55/60/65 %; bosses and the duel keep 60 %.
  const normal = stage <= 4;
  return {
    stage,
    par: boss ? null : normal ? STAGE_PAR_SECONDS[stage - 1] : RIVAL_PAR_SECONDS,
    rockDensity: normal ? STAGE_ROCK_DENSITY[stage - 1] : ROCK_DENSITY_PERCENT,
    level: n,
    sector: sectorOf(n),
    roster: [...LEVELS[n - 1].roster],
    rules: rulesFor(n),
    boss,
    rival: n === LEVEL_COUNT,
    arena: sectorOf(n),
  };
}

/** The Martians to spawn on a level (levels past 20 repeat level 20). */
export function levelRoster(level: number): Kind[] {
  return levelSpec(level).roster;
}

export function levelRules(level: number): LevelRules {
  return levelSpec(level).rules;
}

/** First level of each sector: these get the story card. */
export function isSectorStart(level: number): boolean {
  return level === 1 || level === 6 || level === 11 || level === 16;
}

/** Everything createGame needs for a Story level (roster, hazards, boss, duel, arena, rock density). */
export function storyOptions(level: number): GameOptions {
  const spec = levelSpec(level);
  return { roster: spec.roster, rules: spec.rules, boss: spec.boss, rival: spec.rival, arena: spec.arena, rockDensity: spec.rockDensity };
}
