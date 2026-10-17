import { BossKind, Kind } from '../sim/constants';
import type { LevelSpec } from '../sim/levels';

// Story Mode text: sector cards, the 3-second level briefing, and the ending.
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

/** One line of story context per level, shown on the level briefing. */
const CONTEXT: string[] = [
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

const KIND_NAMES: Record<number, string> = {
  [Kind.Goopling]: 'Gooplings',
  [Kind.Sniffer]: 'Sniffers',
  [Kind.Phaser]: 'Phasers',
  [Kind.Builder]: 'Builders',
};

export interface Briefing {
  title: string;
  context: string;
  goal: string;
  hazards: string;
}

/** The level-start card: story context, the goal and what is switched on. */
export function briefing(spec: LevelSpec, firstSeen: (kind: Kind) => boolean): Briefing {
  const sector = SECTORS[spec.sector - 1];
  const hazards: string[] = [];
  let goal = 'Reach the Warp Gate';
  if (spec.boss) {
    goal = `Survive the ${BOSS_NAMES[spec.boss]}`;
    hazards.push('Goopling spouts');
    if (spec.boss === BossKind.DarknessHive) hazards.push('Blackouts');
    if (spec.boss === BossKind.MazeMaster) hazards.push('Cross blasts', 'Maze Shifts');
  } else if (spec.rival) {
    goal = 'Defeat the Renegade Pilot';
    hazards.push('A rival who plays like you');
  }
  if (spec.rules.mazeShift) hazards.push(spec.rules.frequentEvents ? 'Frequent Maze Shifts' : 'Maze Shifts');
  if (spec.rules.blackout) hazards.push('Blackouts');
  if (spec.rules.gateWander) hazards.push('Wandering Gate');
  if (spec.rules.aggressive) hazards.push('Aggressive Martians');
  const fresh = [...new Set(spec.roster)].filter(firstSeen).map((k) => KIND_NAMES[k]);
  if (fresh.length > 0) hazards.push(`New: ${fresh.join(', ')}`);
  return {
    title: `Level ${spec.level} · ${sector.name}`,
    context: CONTEXT[spec.level - 1],
    goal: `Goal: ${goal}`,
    hazards: `Hazards: ${hazards.length > 0 ? hazards.join(', ') : 'none yet'}`,
  };
}
