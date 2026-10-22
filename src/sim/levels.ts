import { BossKind, Kind } from './constants';

// Survival ("story mode"): 20 levels in 4 sectors of 5. The 5th level of
// each sector is a boss: survival waves on 5, 10 and 15, a duel on 20.
//
// The table below follows the story pacing: each sector brings exactly one
// new Martian species and one new scenario (hazard), introduced by Kit's
// briefing, with the Martian count rising steadily inside each sector.
//
//   Sector 1  Outpost Surface   (1-5)   new: Gooplings; no scenario, no hazards
//   Sector 2  Deep Shafts       (6-10)  new: Sniffers (6), Blackout (7)
//   Sector 3  Tectonic Core     (11-15) new: Phasers + Maze Shift (11); Blackout returns (13), gate drifts (14)
//   Sector 4  Rogue Facility    (16-20) new: Builders + the Hunt (16); then every hazard together

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
}

const { Goopling: G, Sniffer: S, Phaser: P, Builder: B } = Kind;

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
  // Sector 1: Outpost Surface. Gooplings only, no hazards: learn the basics.
  { roster: [G, G] }, //                         1  tutorial: two slow Gooplings
  { roster: [G, G, G] }, //                      2  more Gooplings
  { roster: [G, G, G, G] }, //                   3  a crowd of Gooplings
  { roster: [G, G, G, G, G] }, //                4  the sector's peak
  { roster: [] }, //                             5  Goopling Hive
  // Sector 2: Deep Shafts. New: Sniffers, then Blackouts (the only hazard here).
  { roster: [G, G, S] }, //                      6  first Sniffer; no hazards yet
  { roster: [G, G, S, S], rules: { ...DARK, blackoutFirst: true } }, // 7  first Blackout (Kit warns: it comes first)
  { roster: [G, G, S, S, S], rules: DARK }, //   8  Blackouts, more Sniffers
  { roster: [G, G, G, S, S, S], rules: DARK }, // 9  the sector's peak
  { roster: [] }, //                             10 Darkness Hive
  // Sector 3: Tectonic Core. New: Phasers and Maze Shift; then old hazards return.
  { roster: [G, S, S, P], rules: MAZE }, //      11 first Phaser, first Maze Shift
  { roster: [G, S, S, P, P], rules: MAZE }, //   12 more Phasers, walls keep moving
  { roster: [G, G, S, S, P, P], rules: CORE }, //   13 Blackout returns, events twice as often
  { roster: [G, S, S, P, P, P], rules: DRIFT }, //  14 the gate starts to wander
  { roster: [] }, //                             15 Maze Master
  // Sector 4: Rogue Facility. New: Builders and the Hunt; then every hazard.
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
  return {
    level: n,
    sector: sectorOf(n),
    roster: [...LEVELS[n - 1].roster],
    rules: rulesFor(n),
    boss: BOSSES[n] ?? BossKind.None,
    rival: n === LEVEL_COUNT,
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
