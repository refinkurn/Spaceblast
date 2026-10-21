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
    story: 'Shafts centuries old, yet swept and lit. Somebody is maintaining them. The creatures here are more organized.',
  },
  {
    name: 'Tectonic Core',
    story: 'The heart of Mars. The cavern reshapes itself, and the Martians march in unison toward its center.',
  },
  {
    name: 'Rogue Facility',
    story: 'A command center hidden inside Mars, running the whole hive network. Whoever is in charge knows Bosco is coming.',
  },
];

/** The ending screen's text (the FINAL TEXT of the script). */
export const ENDING =
  'Mars returned to silence. The hives scattered. And one hunter would face justice among the stars. But today, the Astropaws were safe. Today, they were going home.';

/**
 * One line per level, shown on the level card under the sector. Empty on the
 * boss and duel levels (5, 10, 15, 20): their intro scene says it instead.
 */
export const CONTEXT: string[] = [
  'Clear a path through the rocks. We need those power cores to get home.',
  'Movement ahead. Small creatures. Keep your distance.',
  'Sniffers dodge your blasts. Trap them in a corridor.',
  'Watch the creatures. Stay alert.',
  '', // level 5: the boss / duel scene instead
  "Watch for Phasers. An empty corridor doesn't mean you're alone.",
  'Those walls moved on purpose. Someone is rearranging this place. A blackout is next.',
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

/** Bosco's answer to a briefing (kept as data; the level card no longer shows it). */
export const REPLIES: Record<number, string> = {
  3: 'Great. Even the wildlife has a better sense of direction than I do.',
  7: 'So the mine is haunted and has a landlord. Cool.',
  8: 'Now the wildlife has a construction crew. Do they have permits?',
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
