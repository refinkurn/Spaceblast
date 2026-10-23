import { bossWaveCount } from '../sim/boss';
import type { GameState } from '../sim/state';
import { t } from '../utils/i18n';

// Story boss levels: during the last 15 seconds of the final wave, a big
// stopwatch counts down to the boss giving out, so players know they are about
// to make it. Pure UI: reads the boss timer, never writes it.

/** Seconds of the final wave that get the countdown. */
export const COUNTDOWN_SECONDS = 15;

/** Seconds left to show, or null when there's no countdown (not a boss level, not the last wave yet, not in its last 15 s). */
export function bossSecondsLeft(state: GameState): number | null {
  const b = state.boss;
  if (!b || !b.alive || state.status !== 'playing' || state.mode !== 'survival') return null;
  if (b.wave < bossWaveCount(b) || b.timer <= 0 || b.timer > COUNTDOWN_SECONDS * 60) return null;
  return Math.ceil(b.timer / 60);
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class BossCountdown {
  private el = $('boss-clock');
  private shown = -1;

  update(state: GameState, hidden: boolean): void {
    const s = hidden ? null : bossSecondsLeft(state);
    this.el.hidden = s === null;
    if (s === null) { this.shown = -1; return; }
    if (s === this.shown) return;
    this.shown = s;
    $('boss-clock-time').textContent = `0:${String(s).padStart(2, '0')}`;
    $('boss-clock-label').textContent = t('boss.holdOn');
    this.el.classList.toggle('urgent', s <= 5);
    // Restart the tick pulse every second.
    this.el.classList.remove('tick');
    void this.el.offsetWidth;
    this.el.classList.add('tick');
  }
}
