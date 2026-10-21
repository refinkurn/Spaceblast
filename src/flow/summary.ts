import { BossKind } from '../sim/constants';
import type { GameState } from '../sim/state';
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

/** Story: time, lives lost, stars and Martians cleared. */
export function storySummary(state: GameState, livesLost: number, stars: number): [string, string][] {
  const dead = state.martians.filter((m) => !m.alive).length;
  return [
    [t('summary.time'), fmtTime(state.tick)],
    [t('summary.livesLost'), String(livesLost)],
    [t('summary.stars'), stars > 0 ? starText(stars) : '–'],
    [t('summary.martiansCleared'), `${dead} / ${state.martians.length}`],
  ];
}

/** Battle and online: the round time and the score. */
export function battleSummary(state: GameState, tally: string): [string, string][] {
  return [[t('summary.roundTime'), fmtTime(state.tick)], [t('summary.score'), tally]];
}

/** Boss levels never say "destroyed" (docs/story/canon.md): hives rupture, the Maze Master is survived. */
export function bossClearLine(boss: BossKind): string {
  if (boss === BossKind.GooplingHive || boss === BossKind.DarknessHive) return t('boss.hiveRuptured');
  return t('boss.survived', { name: BOSS_NAMES[boss] });
}
