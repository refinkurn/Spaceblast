import { t } from '../utils/i18n';
// The 3-2-1-BLAST! count before Story levels and Battle rounds. Offline it runs
// on real time and holds the game through the `paused` flag in main.ts; it
// never touches the sim. Online rounds can't pause (they run on the room
// server's clock), so the sim holds the start itself (START_HOLD_TICKS) and
// follow() shows the count from the sim's tick: every phone shows the same step.

/** Seconds each step stays on screen. */
export const STEP_SECONDS = 0.6;
export const STEPS = ['3', '2', '1', 'BLAST!'] as const;

/** What to show `elapsed` seconds in, or null once the count is over. */
export function countdownLabel(elapsed: number): string | null {
  if (elapsed < 0) return STEPS[0];
  const i = Math.floor(elapsed / STEP_SECONDS);
  if (i >= STEPS.length) return null;
  return i === STEPS.length - 1 ? t('countdown.go') : STEPS[i];
}

export class Countdown {
  private el = document.getElementById('countdown') as HTMLElement;
  private elapsed = 0;
  private shown: string | null = null;
  /** True while the offline count is on screen: the game is held. */
  active = false;

  start(): void {
    this.elapsed = 0;
    this.active = true;
    this.render();
  }

  cancel(): void {
    this.active = false;
    this.hide();
  }

  /** Call every frame with the real seconds since the last one. */
  update(seconds: number): void {
    if (!this.active) return;
    this.elapsed += seconds;
    this.render();
  }

  /**
   * Online: shows the count `elapsed` seconds into the sim's start hold, or
   * hides it for null. It never sets `active`, so the game is never held here.
   */
  follow(elapsed: number | null): void {
    if (this.active) return; // an offline count owns the overlay
    const label = elapsed === null ? null : countdownLabel(elapsed);
    if (label === null) this.hide();
    else this.show(label);
  }

  private render(): void {
    const label = countdownLabel(this.elapsed);
    if (label === null) return this.cancel();
    this.show(label);
  }

  private hide(): void {
    this.shown = null;
    this.el.hidden = true;
  }

  private show(label: string): void {
    if (label === this.shown) return;
    this.shown = label;
    this.el.textContent = label;
    this.el.classList.toggle('go', label === STEPS[3]);
    this.el.hidden = false;
    // Restart the pop animation for each step.
    this.el.classList.remove('tick');
    void this.el.offsetWidth;
    this.el.classList.add('tick');
  }
}
