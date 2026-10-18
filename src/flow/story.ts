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
 * One line per level, shown on the level card under the sector. Empty on the
 * boss and duel levels (5, 10, 15, 20): their intro scene says it instead.
 */
export const CONTEXT: string[] = [
  'Clear a path through the rocks. We need those power cores to get home.',
  'Movement ahead. Small creatures. Keep your distance.',
  'Watch for those creatures. They track movement.',
  'The creatures are getting more aggressive. Stay alert.',
  '', // level 5: the boss / duel scene instead
  "Watch for Phasers. An empty corridor doesn't mean you're alone.",
  'Blackout ahead. Keep your guard up until visibility returns.',
  "Builders can block your path. Don't let them trap you.",
  "We're getting closer to the core. Expect heavier resistance.",
  '', // level 10: the boss / duel scene instead
  'More Phasers ahead. Stay alert.',
  'Builders are reinforcing the passages. Watch your route.',
  "The maze is shifting. Don't count on the way back staying open.",
  "We're close to the center. Stay focused.",
  '', // level 15: the boss / duel scene instead
  "These attacks aren't random anymore. Stay sharp.",
  "Someone knows we're here. Keep moving.",
  'The control room should be close. No detours.',
  'Last stretch, Bosco. Bring those cores home.',
  '', // level 20: the boss / duel scene instead
];

export const BOSS_NAMES: Record<number, string> = {
  [BossKind.GooplingHive]: 'Goopling Hive',
  [BossKind.DarknessHive]: 'Darkness Hive',
  [BossKind.MazeMaster]: 'Maze Master',
};

/** The level card: "LEVEL 5", "SECTOR 1: OUTPOST SURFACE" and the level's one-line briefing. */
export function levelCard(spec: LevelSpec): { level: string; sector: string; briefing: string } {
  return {
    level: `LEVEL ${spec.level}`,
    sector: `SECTOR ${spec.sector}: ${SECTORS[spec.sector - 1].name.toUpperCase()}`,
    briefing: CONTEXT[spec.level - 1] ?? '',
  };
}
