import { BossKind, Kind } from './constants';

// Survival ("story mode"): 20 levels in 4 sectors of 5. The 5th level of
// each sector is a boss: survival waves on 5, 10 and 15, a duel on 20.
//
//   Sector 1  Outpost Surface   (1-5)   Gooplings, then Sniffers; no hazards
//   Sector 2  Deep Shafts       (6-10)  Phasers and Builders; Maze Shift, Blackouts
//   Sector 3  Tectonic Core     (11-15) frequent Maze Shifts, wandering gate
//   Sector 4  Rogue Facility    (16-20) every hazard, aggressive Martians

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
}

export const NO_EVENTS: LevelRules = { mazeShift: false, gateWander: false, blackout: false, frequentEvents: false, aggressive: false };

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

/** Martians per level; boss levels spawn theirs from the boss instead. */
const ROSTERS: Kind[][] = [
  [G, G, G], [G, G, G, G], [G, G, G, S], [G, G, G, S, S], [],
  [G, G, S, P], [G, G, S, P, P], [G, S, S, P, B], [G, G, S, S, P, B], [],
  [G, G, S, S, P, B], [G, S, S, P, P, B], [G, G, S, S, P, P, B], [G, S, S, P, P, B, B], [],
  [G, G, S, S, P, P, B], [G, S, S, P, P, B, B], [G, G, S, S, P, P, B, B], [G, S, S, S, P, P, B, B], [],
];

const BOSSES: Record<number, BossKind> = { 5: BossKind.GooplingHive, 10: BossKind.DarknessHive, 15: BossKind.MazeMaster };

function rulesFor(level: number): LevelRules {
  const sector = sectorOf(level);
  if (BOSSES[level]) return NO_EVENTS; // the boss drives its own hazards
  if (level === LEVEL_COUNT) return { ...NO_EVENTS, mazeShift: true }; // the duel's grid keeps changing
  switch (sector) {
    case 1: return NO_EVENTS;
    case 2: return { ...NO_EVENTS, mazeShift: true, blackout: level >= 7 };
    case 3: return { ...NO_EVENTS, mazeShift: true, blackout: true, gateWander: true, frequentEvents: true };
    default: return { mazeShift: true, blackout: true, gateWander: true, frequentEvents: true, aggressive: true };
  }
}

export function sectorOf(level: number): number {
  return Math.min(4, Math.ceil(Math.max(1, Math.min(level, LEVEL_COUNT)) / 5));
}

export function levelSpec(level: number): LevelSpec {
  const n = Math.max(1, Math.min(level, LEVEL_COUNT));
  return {
    level: n,
    sector: sectorOf(n),
    roster: [...ROSTERS[n - 1]],
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
