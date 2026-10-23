import { BossKind } from '../sim/constants';
import { START_LIVES } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { MatchTally } from './match_tally';
import { BOSS_NAMES } from './story';
import { t } from '../utils/i18n';

// Words for the end-of-match screen. Pure: reads state, writes nothing.

export type BannerPose = 'happy' | 'defeated' | 'neutral';
export interface BannerExtra {
  pose?: BannerPose;
  /** Label / value rows shown under the title. */
  summary?: [string, string][];
  /** What the second button does instead of opening the menu (Story: back to the map). */
  onMenu?: () => void;
}

export const fmtTime = (ticks: number) => {
  const s = Math.floor(Math.max(0, ticks) / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** What you did on the map: Martians defeated, rocks destroyed, power-ups picked up. */
function impact(m: MatchTally, withMartians: boolean): [string, string][] {
  const rows: [string, string][] = [];
  if (withMartians) rows.push([t('summary.martians'), String(m.martians)]);
  rows.push([t('summary.rocks'), String(m.rocks)], [t('summary.powerups'), String(m.powerups)]);
  return rows;
}

/**
 * Story, one row each: stars (a clear only), time, hearts left, then the impact
 * rows. `stars` is 0 on a game over.
 */
export function storySummary(state: GameState, m: MatchTally, livesLost: number, stars: number): [string, string][] {
  const rows: [string, string][] = [];
  if (stars > 0) rows.push([t('summary.stars'), starText(stars)]);
  rows.push([t('summary.time'), fmtTime(state.tick)]);
  if (stars > 0) rows.push([t('summary.hearts'), `${START_LIVES - Math.min(livesLost, START_LIVES)} / ${START_LIVES}`]);
  return [...rows, ...impact(m, true)];
}

/** Battle and online: the score, the round time, then rocks and power-ups (no Martians there). */
export function battleSummary(state: GameState, m: MatchTally, score: string): [string, string][] {
  return [[t('summary.score'), score], [t('summary.roundTime'), fmtTime(state.tick)], ...impact(m, false)];
}

/** Boss levels never say "destroyed" (docs/story/canon.md): hives rupture, the Maze Master is survived. */
export function bossClearLine(boss: BossKind): string {
  if (boss === BossKind.GooplingHive || boss === BossKind.DarknessHive) return t('boss.hiveRuptured');
  return t('boss.survived', { name: BOSS_NAMES[boss] });
}
