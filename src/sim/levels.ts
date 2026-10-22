import { BossKind, Kind } from './constants';

// Survival ("story mode"): 20 levels in 4 sectors of 5. The 5th level of
// each sector is a boss: survival waves on 5, 10 and 15, a duel on 20.
//
// The table below follows the story (docs/design/level-progression.md): one
// new idea per level, introduced by Kit's briefing for that level, and the
// Martian count rising steadily inside each sector.
//
//   Sector 1  Outpost Surface   (1-5)   learn the basics: Gooplings, then Sniffers; no hazards
//   Sector 2  Deep Shafts       (6-10)  Phasers, Maze Shift, a Blackout, Builders
//   Sector 3  Tectonic Core     (11-15) the cavern reshapes itself: frequent events, then a wandering gate
//   Sector 4  Rogue Facility    (16-20) Ducking's army hunts you, every hazard

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
const DARK: Partial<LevelRules> = { mazeShift: true, blackout: true };
const CORE: Partial<LevelRules> = { mazeShift: true, blackout: true, frequentEvents: true };
const DRIFT: Partial<LevelRules> = { ...CORE, gateWander: true };
const HUNT: Partial<LevelRules> = { ...DRIFT, aggressive: true };

/**
 * Per level: the Martians (boss levels bring their own) and the hazards.
 * The comment is what Kit's briefing (story.ts CONTEXT) promises there.
 */
const LEVELS: { roster: Kind[]; rules?: Partial<LevelRules> }[] = [
  // Sector 1: Outpost Surface. On the surface, learning the basics. No hazards.
  { roster: [G, G] }, //                         1  "Clear a path through the rocks." Tutorial: two slow Gooplings.
  { roster: [G, G, G] }, //                      2  "Small creatures. Keep your distance."
  { roster: [G, G, S] }, //                      3  "Sniffers dodge your blasts." The first Sniffer.
  { roster: [G, G, S, S] }, //                   4  "Watch the creatures." Everything sector 1 has, together.
  { roster: [] }, //                             5  Goopling Hive
  // Sector 2: Deep Shafts. Underground, maintained, organized.
  { roster: [G, G, S, P], rules: MAZE }, //      6  "Watch for Phasers." Walls start to move.
  { roster: [G, S, P, P], rules: { ...DARK, blackoutFirst: true } }, // 7  "Those walls moved on purpose... A blackout is next."
  { roster: [G, S, P, B], rules: DARK }, //      8  "Builders can block your path." The first Builder.
  { roster: [G, G, S, P, P, B], rules: DARK }, // 9  "Expect heavier resistance." The sector's peak.
  { roster: [] }, //                             10 Darkness Hive
  // Sector 3: Tectonic Core. The cavern reshapes itself, faster and faster.
  { roster: [G, S, P, P, P, B], rules: CORE }, //   11 "More Phasers ahead." Events come twice as often.
  { roster: [G, S, P, P, B, B], rules: CORE }, //   12 "Builders are reinforcing the passages."
  { roster: [G, G, S, S, P, P, B], rules: DRIFT }, // 13 "Don't count on the way back staying open." The gate starts to wander.
  { roster: [G, S, S, P, P, B, B], rules: DRIFT }, // 14 "We're close to the center."
  { roster: [] }, //                             15 Maze Master
  // Sector 4: Rogue Facility. Ducking's army: Martians hunt you, every hazard.
  { roster: [G, G, S, S, P, P, B], rules: HUNT }, //       16 "These attacks aren't random anymore."
  { roster: [G, S, S, P, P, B, B], rules: HUNT }, //       17 "Someone knows we're here."
  { roster: [G, G, S, S, P, P, B, B], rules: HUNT }, //    18 "The control room should be close."
  { roster: [G, S, S, S, P, P, P, B, B], rules: HUNT }, // 19 "Last stretch." The hardest level.
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
