import { t } from '../utils/i18n';
// The 3-2-1-BLAST! count before offline Story levels and Battle rounds. It runs on
// real time and holds the game through the `paused` flag in main.ts; it never
// touches the sim. Online rounds start on the room server's clock, so no countdown there.

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
  /** True while the count is on screen: the game is held. */
  active = false;

  start(): void {
    this.elapsed = 0;
    this.active = true;
    this.render();
  }

  cancel(): void {
    this.active = false;
    this.shown = null;
    this.el.hidden = true;
  }

  /** Call every frame with the real seconds since the last one. */
  update(seconds: number): void {
    if (!this.active) return;
    this.elapsed += seconds;
    this.render();
  }

  private render(): void {
    const label = countdownLabel(this.elapsed);
    if (label === null) return this.cancel();
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
