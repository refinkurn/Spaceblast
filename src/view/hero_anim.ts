// Procedural "juice" for the astronauts (Bosco, the duel's Ducking, online
// players): idle breathing, a forward lean while running, a squash when a
// charge is dropped, and a shake + flash when hurt. View only: the sim knows
// nothing about it, so online play can't desync. Also drives the limbs of the
// low-poly figure (view/astronaut_mesh.ts, docs/design/character-animation.md):
// a run cycle that follows the real speed, arms forward to place a charge,
// arms up when hurt or celebrating. Limb angles are radians on the x axis of
// each pivot; positive swings the limb forward (-z).

/** Squash when dropping a charge: height to 0.75, width to 1.15, springing back in about 120 ms. */
export const SQUASH = { y: 0.75, xz: 1.15, seconds: 0.12 } as const;
/** Hurt: a 200 ms shake with a white flash. */
export const HURT_SECONDS = 0.2;
/** Forward lean while running, radians. */
export const RUN_LEAN = 0.16;

/** Run cycle: legs swing +-35 degrees, arms +-25 degrees opposite to the legs. */
export const LEG_SWING = (35 * Math.PI) / 180;
export const ARM_SWING = (25 * Math.PI) / 180;
/** Cycle phase (radians) gained per tile run: one full cycle (two steps) per 0.9 tile, so feet slide little. */
export const PHASE_PER_TILE = (2 * Math.PI) / 0.9;
/** Arm angles for the poses: forward to place a charge (100 ms), straight up when hurt or celebrating. */
export const PLACE_ARM = 1.2;
export const PLACE_SECONDS = 0.1;
export const UP_ARM = 2.8;
/** Time constant of the blend in and out of the run cycle (about 80 ms to settle). */
const RUN_BLEND = 0.027;

export interface Limbs {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Extra dip of the torso on each step (world units, <= 0). */
  dip: number;
}

/** Limb angles for a cycle `phase` at run strength `w` (0 = standing, 1 = running). Legs swing opposite each other; each arm opposes its same-side leg. */
export function runLimbs(phase: number, w: number): Limbs {
  const s = Math.sin(phase) * w;
  return { legL: LEG_SWING * s, legR: -LEG_SWING * s, armL: -ARM_SWING * s, armR: ARM_SWING * s, dip: -0.025 * w * Math.abs(Math.cos(phase)) };
}

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

export interface Pose extends Omit<Limbs, 'dip'> {
  scaleY: number;
  scaleXZ: number;
  lean: number;
  tilt: number;
  rise: number;
  shake: number;
  flash: number;
}

/** Per-astronaut timers. */
export class HeroAnimator {
  private squashT = -1;
  private hurtT = -1;
  private idleT = 0;
  private leanNow = 0;
  private runW = 0;
  private phase = 0;
  private placeT = -1;
  private armsUp = 0;
  /** Set by the view while the victory dance runs. */
  celebrating = false;

  squash(): void {
    this.squashT = 0;
    this.placeT = 0;
  }

  hurt(): void {
    this.hurtT = 0;
  }

  /** Advances the timers and returns this frame's pose (added on top of the walk bob and facing). */
  step(dt: number, moving: boolean, tilesPerSecond = 0): Pose {
    if (this.squashT >= 0) this.squashT += dt;
    if (this.hurtT >= 0) this.hurtT += dt;
    this.idleT = moving ? 0 : this.idleT + dt;
    this.leanNow += ((moving ? RUN_LEAN : 0) - this.leanNow) * (1 - Math.exp(-14 * dt));
    const sq = squashScale(squashAmount(this.squashT));
    const h = hurtAt(this.hurtT);
    if (this.squashT >= SQUASH.seconds) this.squashT = -1;
    if (this.hurtT >= HURT_SECONDS) this.hurtT = -1;
    this.runW += ((moving ? 1 : 0) - this.runW) * (1 - Math.exp(-dt / RUN_BLEND));
    if (moving) this.phase = (this.phase + dt * tilesPerSecond * PHASE_PER_TILE) % (2 * Math.PI);
    else if (this.runW < 0.01) this.phase = 0;
    const limbs = runLimbs(this.phase, this.runW);
    const up = this.celebrating || h.flash > 0 ? 1 : 0;
    this.armsUp += (up - this.armsUp) * (1 - Math.exp(-dt * 25));
    if (this.placeT >= 0) this.placeT += dt;
    const place = this.placeT >= 0 && this.placeT < PLACE_SECONDS ? Math.sin((Math.PI * this.placeT) / PLACE_SECONDS) : 0;
    if (this.placeT >= PLACE_SECONDS) this.placeT = -1;
    const arm = (swing: number): number => (swing * (1 - place) + PLACE_ARM * place) * (1 - this.armsUp) + UP_ARM * this.armsUp;
    const b = moving ? { y: 0, tilt: 0 } : breathe(this.idleT);
    return { scaleY: sq.y, scaleXZ: sq.xz, lean: this.leanNow, tilt: b.tilt, rise: b.y + limbs.dip, shake: h.offset, flash: h.flash, legL: limbs.legL, legR: limbs.legR, armL: arm(limbs.armL), armR: arm(limbs.armR) };
  }
}
