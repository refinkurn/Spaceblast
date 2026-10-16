import { BLACKOUT_FROM_LEVEL, GATE_WANDER_FROM_LEVEL, Kind, MAZE_SHIFT_FROM_LEVEL } from './constants';

// Survival: 20 levels in 4 sectors of 5. Each sector adds the next Martian
// kind; numbers grow inside a sector. Events switch on at fixed levels:
// Maze Shift from 5, the wandering Warp Gate from 8, Blackout from 10.
// Level 20 will get the Blaster boss.

export const LEVEL_COUNT = 20;
const SECTOR_KIND = [Kind.Goopling, Kind.Sniffer, Kind.Phaser, Kind.Builder] as const;
const MAX_MARTIANS = 8;

export function sectorOf(level: number): number {
  return Math.min(4, Math.ceil(Math.min(level, LEVEL_COUNT) / 5));
}

/** The Martians to spawn on a level (levels past 20 repeat level 20's roster). */
export function levelRoster(level: number): Kind[] {
  const n = Math.max(1, Math.min(level, LEVEL_COUNT));
  const sector = sectorOf(n);
  const step = (n - 1) % 5; // 0..4 within the sector
  const total = Math.min(MAX_MARTIANS, 3 + Math.floor(step / 2) + (sector - 1));
  const newest = SECTOR_KIND[sector - 1];
  const older = SECTOR_KIND.slice(0, sector - 1);
  const newCount = older.length === 0 ? total : 1 + Math.floor(step / 2);
  const roster: Kind[] = Array<Kind>(newCount).fill(newest);
  // Fill the rest with older kinds, the most recent first.
  for (let i = 0; roster.length < total; i++) roster.push(older[older.length - 1 - (i % older.length)]);
  return roster;
}

/** Which level events are switched on. */
export interface LevelRules {
  mazeShift: boolean;
  gateWander: boolean;
  blackout: boolean;
}

export const NO_EVENTS: LevelRules = { mazeShift: false, gateWander: false, blackout: false };

export function levelRules(level: number): LevelRules {
  return {
    mazeShift: level >= MAZE_SHIFT_FROM_LEVEL,
    gateWander: level >= GATE_WANDER_FROM_LEVEL,
    blackout: level >= BLACKOUT_FROM_LEVEL,
  };
}
