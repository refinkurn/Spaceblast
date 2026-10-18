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
    story: 'Shafts carved through solid rock, with markings no Martian made. Someone built these. The creatures here are more organized.',
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

/** Bosco's answer to a briefing, under it on the level card. */
export const REPLIES: Record<number, string> = {
  3: 'Great. Even the wildlife has a better sense of direction than I do.',
  8: 'The locals build walls now? Wonderful.',
};

/** The level card: "LEVEL 5", "SECTOR 1: OUTPOST SURFACE" and the level's one-line briefing. */
export function levelCard(spec: LevelSpec): { level: string; sector: string; briefing: string; reply: string } {
  return {
    level: `LEVEL ${spec.level}`,
    sector: `SECTOR ${spec.sector}: ${SECTORS[spec.sector - 1].name.toUpperCase()}`,
    briefing: CONTEXT[spec.level - 1] ?? '',
    reply: REPLIES[spec.level] ?? '',
  };
}
