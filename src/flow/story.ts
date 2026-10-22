import { BossKind } from '../sim/constants';
import type { LevelSpec } from '../sim/levels';

// Story Mode text: sector cards, the level card, and the ending.
// Plain data so the story can be rewritten without touching game code.

export interface SectorStory {
  name: string;
  story: string;
}

/**
 * Sector names, and the story card a sector shows if it has no opening scene
 * (all four have one now: see story_scenes.ts).
 */
export const SECTORS: SectorStory[] = [
  {
    name: 'Outpost Surface',
    story: "The Biscuit crash-lands on Mars and its power cores are stolen. Bosco heads out to get them back, with Captain Kit on the radio.",
  },
  {
    name: 'Deep Shafts',
    story: 'Shafts centuries old, yet swept and lit. Somebody is maintaining them. But the power down here is failing.',
  },
  {
    name: 'Tectonic Core',
    story: 'The heart of Mars: a crystal cavern that reshapes itself. Something down here is moving the walls.',
  },
  {
    name: 'Rogue Facility',
    story: 'A command center hidden inside Mars, running the whole hive network. Whoever is in charge knows Bosco is coming.',
  },
];

/** The ending screen's text (the FINAL TEXT of the script). */
export const ENDING =
  'Mars returned to silence. The Martians went back to the wild. And one hunter would face justice among the stars. But today, the Astropaws were safe. Today, they were going home.';

/**
 * One line per level, shown on the level card under the sector. Empty on the
 * boss and duel levels (5, 10, 15, 20): their intro scene says it instead.
 */
export const CONTEXT: string[] = [
  'Clear a path through the rocks. We need those power cores to get home.',
  'Movement ahead. Small creatures. Keep your distance.',
  'More Gooplings. Lure them into your blasts.',
  'The whole herd is out. Stay alert.',
  '', // level 5: the boss / duel scene instead
  'New readings: Sniffers. They dodge your blasts, so trap them in a corridor.',
  'The power down here is failing. When the lights go, trust your memory.',
  "Sniffers hunt by smell. The dark doesn't slow them down.",
  'Blackouts come more often now. Something big is close.',
  '', // level 10: the boss / duel scene instead
  "Phasers ahead. An empty corridor doesn't mean you're alone. And these walls move.",
  'Those walls moved on purpose. Someone is rearranging this place.',
  'Shifts and blackouts together now. The cavern changes faster here.',
  "The gate drifts with the walls. Don't count on the way back staying open.",
  '', // level 15: the boss / duel scene instead
  "Builders, fortifying the base. And the Martians are hunting you now.",
  "These attacks aren't random anymore. Someone knows we're here.",
  'The control room should be close. No detours.',
  'Last stretch, Bosco. Bring those cores home.',
  '', // level 20: the boss / duel scene instead
];

export const BOSS_NAMES: Record<number, string> = {
  [BossKind.GooplingHive]: 'Goopling Hive',
  [BossKind.DarknessHive]: 'Darkness Hive',
  [BossKind.MazeMaster]: 'Maze Master',
};

/** Bosco's answer to a briefing (kept as data; the level card no longer shows it). */
export const REPLIES: Record<number, string> = {
  3: 'Great. Even the wildlife has a better sense of direction than I do.',
  7: 'So the mine is haunted and has a landlord. Cool.',
  16: 'Now the wildlife has a construction crew. Do they have permits?',
};

export type GoalIcon = 'gate' | 'shield' | 'duel';

export interface LevelCardText {
  /** "1-3" (sector-level within the sector); boss levels add " BOSS". */
  title: string;
  sector: string;
  goal: { icon: GoalIcon; text: string };
  /** Kit's briefing, one line, no speaker name. */
  briefing: string;
}

/** The compact level card: `1-3` title, sector name, goal row and Kit's line. Bosco's reply (REPLIES) is no longer shown. */
export function levelCard(spec: LevelSpec): LevelCardText {
  const inSector = ((spec.level - 1) % 5) + 1;
  const goal: LevelCardText['goal'] = spec.rival
    ? { icon: 'duel', text: 'Stun Ducking' }
    : spec.boss !== BossKind.None
      ? { icon: 'shield', text: 'Survive 3 waves' }
      : { icon: 'gate', text: 'Find the Warp Gate' };
  return {
    title: `${spec.sector}-${inSector}${spec.boss !== BossKind.None ? ' BOSS' : ''}`,
    sector: SECTORS[spec.sector - 1].name.toUpperCase(),
    goal,
    briefing: CONTEXT[spec.level - 1] ?? '',
  };
}
