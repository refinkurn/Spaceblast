// Automatic render quality: if frames are slow for a while (an older phone),
// draw at a lower pixel ratio. Steps only go down, never back up, so the
// picture can't flicker between two settings.

/** Average frame time above this (ms, about 45 fps) counts as slow. */
const SLOW_MS = 22;
/** Frames measured before each decision (about 2 s). */
const WINDOW = 120;
const STEPS = [2, 1.5, 1];

export class AdaptiveQuality {
  private sum = 0;
  private count = 0;
  private step: number;
  private readonly start: number;

  /** `deviceRatio`: window.devicePixelRatio. */
  constructor(deviceRatio: number) {
    this.step = STEPS.findIndex((r) => r <= Math.max(1, deviceRatio));
    if (this.step < 0) this.step = STEPS.length - 1;
    this.start = this.step;
  }

  /** True once the picture has stepped down: extras like auras and idle sparkles switch off. */
  get reduced(): boolean {
    return this.step > this.start;
  }

  get pixelRatio(): number {
    return STEPS[this.step];
  }

  /**
   * One frame took `ms`. Returns the new pixel ratio when it should drop, else null.
   * Huge gaps (a hidden tab, a pause) are ignored.
   */
  frame(ms: number): number | null {
    if (ms > 250 || this.step === STEPS.length - 1) return null;
    this.sum += ms;
    if (++this.count < WINDOW) return null;
    const slow = this.sum / this.count > SLOW_MS;
    this.sum = 0;
    this.count = 0;
    if (!slow) return null;
    this.step++;
    return this.pixelRatio;
  }
}
