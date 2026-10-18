import { BossKind } from '../sim/constants';
import type { LevelSpec } from '../sim/levels';

// Story Mode text: sector cards, the level card, and the ending.
// Plain data so the story can be rewritten without touching game code.

export interface SectorStory {
  name: string;
  story: string;
}

export const SECTORS: SectorStory[] = [
  {
    name: 'Outpost Surface',
    story:
      'The Astro Paws crash-land beside an abandoned mining outpost on Mars. The Martian Hive has woken up hungry, ' +
      'and the ship\'s cores are scattered across the planet. Captain Kit\'s orders: reach the Warp Gates and get the crew out alive.',
  },
  {
    name: 'Deep Shafts',
    story:
      'The cores\' signal leads underground, into the old mining shafts. Down here Phasers burrow through the walls, ' +
      'Builders seal the tunnels behind you, and the lights fail without warning.',
  },
  {
    name: 'Tectonic Core',
    story:
      'Deep in the crust the ground itself is moving. The Hive reshapes the maze around you every few seconds, ' +
      'and the Warp Gates drift away if you hesitate.',
  },
  {
    name: 'Rogue Facility',
    story:
      'At the bottom of it all: a sealed research facility, and someone is running it. ' +
      'The Martians here hunt in packs, and a rogue pilot is waiting at the last gate.',
  },
];

export const ENDING =
  'The Renegade Pilot is down and the last ship core is back on board. The Astro Paws lift off from Mars and head for home.';

/**
 * One line of story context per level. Not shown at the moment: the level card
 * only shows the level and its sector.
 */
export const CONTEXT: string[] = [
  'Touching down outside the outpost. Scout the surface.',
  'Following the crash trail across the dunes.',
  'Something faster is sniffing around the outpost walls.',
  'The outpost supply depot is crawling with Martians.',
  'The Goopling Hive guards the outpost core.',
  'Descending into the deep shafts.',
  'The shaft lights flicker. Keep moving.',
  'Builders are sealing off the lower tunnels.',
  'The core signal is strong down here.',
  'The Darkness Hive lurks at the bottom of the shafts.',
  'The crust is unstable. Walls move on their own.',
  'Warp Gates drift through the tectonic rifts.',
  'The Hive reshapes the maze faster now.',
  'Almost through the core.',
  'The Maze Master rules the tectonic core.',
  'Breaching the Rogue Facility\'s outer doors.',
  'The Martians here hunt in packs.',
  'Security corridors, every hazard switched on.',
  'The facility control room is close.',
  'The Renegade Pilot blocks the last gate.',
];

export const BOSS_NAMES: Record<number, string> = {
  [BossKind.GooplingHive]: 'Goopling Hive',
  [BossKind.DarknessHive]: 'Darkness Hive',
  [BossKind.MazeMaster]: 'Maze Master',
};

/** The level card: "LEVEL 5" and "SECTOR 1: OUTPOST SURFACE". */
export function levelCard(spec: LevelSpec): { level: string; sector: string } {
  return {
    level: `LEVEL ${spec.level}`,
    sector: `SECTOR ${spec.sector}: ${SECTORS[spec.sector - 1].name.toUpperCase()}`,
  };
}
