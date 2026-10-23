import { START_LIVES } from '../sim/constants';
import { LEVEL_COUNT, levelRoster, levelSpec } from '../sim/levels';
import { parSeconds, scoreTarget } from '../services/score';
import { BOSS_NAMES, SECTORS, levelCard } from './story';
import { LEVELS_PER_SECTOR } from './map_layout';
import { t } from '../utils/i18n';

// Words and numbers on the Story map (docs/design/story-map.md). Pure: no DOM.

const num = (n: number) => n.toLocaleString('en-US');

/** The Core signal gauge: levels cleared out of 20, or "recovered" once the story is finished. */
export function coreSignal(unlocked: number, finished: boolean): { filled: number; label: string; done: boolean } {
  const filled = finished ? LEVEL_COUNT : Math.max(0, unlocked - 1);
  return { filled, label: finished ? t('map.coresRecovered') : t('map.coreSignal', { n: filled, total: LEVEL_COUNT }), done: finished };
}

/** "SECTOR 2 · ABANDONED MINING COLONY". */
export function sectorTitle(sector: number): string {
  return t('map.sectorTitle', { n: sector, name: SECTORS[sector - 1].name.toUpperCase() });
}

/** "★ 12/15" for one sector. */
export function sectorStars(sector: number, starsOf: (level: number) => number): string {
  let have = 0;
  for (let i = 1; i <= LEVELS_PER_SECTOR; i++) have += starsOf((sector - 1) * LEVELS_PER_SECTOR + i);
  return `★ ${have}/${LEVELS_PER_SECTOR * 3}`;
}

/** The name under a boss node: the hive or Maze Master, or Ducking for the level 20 duel. Null for normal levels. */
export function bossLabel(level: number): string | null {
  const spec = levelSpec(level);
  if (spec.rival) return 'Ducking';
  return spec.boss ? BOSS_NAMES[spec.boss] : null;
}

/** The node card's goal row: "Find the Warp Gate · 4 Martians", "Survive 3 waves" or "Stun Ducking". */
export function nodeGoal(level: number): string {
  const spec = levelSpec(level);
  const goal = levelCard(spec).goal.text;
  return spec.boss || spec.rival ? goal : t('map.goalMartians', { goal, n: levelRoster(level).length });
}

/** The 3-star checklist, each line ticked when that star is already earned (stars per services/score.ts). */
export function starChecklist(level: number, stars: number): { text: string; done: boolean }[] {
  const par = parSeconds(level);
  return [
    { text: t('map.check.clear'), done: stars >= 1 },
    { text: t('map.check.score', { n: num(scoreTarget(level)) }), done: stars >= 2 },
    { text: par === null ? t('map.check.hearts', { n: START_LIVES }) : t('map.check.heartsPar', { n: START_LIVES, par }), done: stars >= 3 },
  ];
}

/** "Best: 8,540", or '' before a best score exists. */
export function bestLine(best: number): string {
  return best > 0 ? t('map.best', { n: num(best) }) : '';
}

/** Sector 1 is above ground; the rest are reached through tunnels. */
export function enterLabel(level: number): string {
  return levelSpec(level).sector === 1 ? t('map.enter') : t('map.enterTunnel');
}
