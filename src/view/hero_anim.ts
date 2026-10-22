// Procedural "juice" for the astronauts (Bosco, the duel's Ducking, online
// players): idle breathing, a forward lean while running, a squash when a
// charge is dropped, and a shake + flash when hurt. View only: the sim knows
// nothing about it, so online play can't desync. The current figure has no
// limbs; a leg/arm swing comes with the low-poly figure
// (docs/design/character-animation.md).

/** Squash when dropping a charge: height to 0.75, width to 1.15, springing back in about 120 ms. */
export const SQUASH = { y: 0.75, xz: 1.15, seconds: 0.12 } as const;
/** Hurt: a 200 ms shake with a white flash. */
export const HURT_SECONDS = 0.2;
/** Forward lean while running, radians. */
export const RUN_LEAN = 0.16;

/** 1 at the moment of the squash, easing to 0 by SQUASH.seconds. */
export function squashAmount(t: number): number {
  if (t < 0 || t >= SQUASH.seconds) return 0;
  const k = 1 - t / SQUASH.seconds;
  return k * k;
}

/** Body scale for a squash amount (0 = normal). */
export function squashScale(a: number): { y: number; xz: number } {
  return { y: 1 - (1 - SQUASH.y) * a, xz: 1 + (SQUASH.xz - 1) * a };
}

/** Sideways shake offset (world units) and flash strength (0..1) at `t` seconds into a hurt. */
export function hurtAt(t: number): { offset: number; flash: number } {
  if (t < 0 || t >= HURT_SECONDS) return { offset: 0, flash: 0 };
  const fade = 1 - t / HURT_SECONDS;
  return { offset: 0.07 * fade * Math.sin(t * 2 * Math.PI * 30), flash: fade };
}

/** Idle breathing: a small rise and a slight tilt, about one breath every 2.5 s. */
export function breathe(t: number): { y: number; tilt: number } {
  const s = Math.sin((t * 2 * Math.PI) / 2.5);
  return { y: 0.012 * s, tilt: 0.03 * s };
}

/** Per-astronaut timers. */
export class HeroAnimator {
  private squashT = -1;
  private hurtT = -1;
  private idleT = 0;
  private leanNow = 0;

  squash(): void {
    this.squashT = 0;
  }

  hurt(): void {
    this.hurtT = 0;
  }

  /** Advances the timers and returns this frame's pose (added on top of the walk bob and facing). */
  step(dt: number, moving: boolean): { scaleY: number; scaleXZ: number; lean: number; tilt: number; rise: number; shake: number; flash: number } {
    if (this.squashT >= 0) this.squashT += dt;
    if (this.hurtT >= 0) this.hurtT += dt;
    this.idleT = moving ? 0 : this.idleT + dt;
    this.leanNow += ((moving ? RUN_LEAN : 0) - this.leanNow) * (1 - Math.exp(-14 * dt));
    const sq = squashScale(squashAmount(this.squashT));
    const h = hurtAt(this.hurtT);
    if (this.squashT >= SQUASH.seconds) this.squashT = -1;
    if (this.hurtT >= HURT_SECONDS) this.hurtT = -1;
    const b = moving ? { y: 0, tilt: 0 } : breathe(this.idleT);
    return { scaleY: sq.y, scaleXZ: sq.xz, lean: this.leanNow, tilt: b.tilt, rise: b.y, shake: h.offset, flash: h.flash };
  }
}
