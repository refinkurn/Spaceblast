import * as THREE from 'three';
import { GRID_H, GRID_W } from '../sim/constants';

/** Impact shake (docs/design/radio-juice.md): world units at full strength, decay time, wobble rate, and when it is over. */
const SHAKE_AMP = 0.06;
const SHAKE_DECAY = 0.06;
const SHAKE_HZ = 18;
export const SHAKE_END = 0.25;
/** Blasts this many tiles (Manhattan) or more from you don't shake. */
const SHAKE_REACH = 7;

/** Shake strength 0..1 for an explosion `tiles` (Manhattan) away from the local player. */
export function blastShake(tiles: number): number {
  return Math.max(0, 1 - tiles / SHAKE_REACH);
}

/** The shake offset `t` seconds into an impulse of strength `amp` (0 once it is over). */
export function shakeOffset(amp: number, t: number): number {
  if (t >= SHAKE_END) return 0;
  return amp * SHAKE_AMP * Math.exp(-t / SHAKE_DECAY) * Math.sin(2 * Math.PI * SHAKE_HZ * t);
}

/**
 * Fixed angled top-down camera. Fits the arena (plus its border) into the
 * screen area left free between the touch-control gutters and below the HUD,
 * so thumbs never cover the maze.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  /** Camera tilt: 90 = straight down. Higher = more top-down, less depth. */
  pitchDeg = 66;
  /** How much of the outer border ring stays in frame (0 = none, 1 = all). */
  borderInFrame = 0.35;
  private base = new THREE.Vector3();
  /** Screen shake setting (off: no shake at all). */
  shakeOn = true;
  /** The running impulse: strength 0..1 and seconds since it started; the strongest request this frame. */
  private shakeAmp = 0;
  private shakeT = SHAKE_END;
  private shakeAsk = 0;
  /** Where the fitted camera looks, and how far away it sits. */
  private aim = new THREE.Vector3();
  private dist = 20;
  private dir = new THREE.Vector3();
  /** Cinematic close-up: current and wanted look-at point and zoom (1 = normal view). */
  private look = new THREE.Vector3();
  private lookGoal = new THREE.Vector3();
  private zoom = 1;
  private zoomGoal = 1;
  private focused = false;

  /** The board's screen rectangle (CSS px, outer wall included) after the last fit. */
  board = { left: 0, right: 0, top: 0, bottom: 0 };
  /** The board's left outline on screen (CSS px): far corner (top) and near corner (bottom), outer wall included. */
  leftEdge = { topX: 0, topY: 0, bottomX: 0, bottomY: 0 };

  /** Free area in CSS pixels: the camera keeps the board inside it. */
  fit(viewW: number, viewH: number, left: number, right: number, top: number, bottom: number): void {
    const cam = this.camera;
    cam.aspect = viewW / viewH;
    cam.updateProjectionMatrix();

    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const halfW = GRID_W / 2 + this.borderInFrame;
    const halfD = GRID_H / 2 + this.borderInFrame;
    const corners = [-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz) => [0, 1].map((y) => new THREE.Vector3(sx * halfW, y, sz * halfD))),
    );
    // Target rectangle in normalised device coordinates.
    const nx0 = (left / viewW) * 2 - 1;
    const nx1 = ((viewW - right) / viewW) * 2 - 1;
    const ny0 = 1 - ((viewH - bottom) / viewH) * 2;
    const ny1 = 1 - (top / viewH) * 2;

    let aim = new THREE.Vector3();
    const p = new THREE.Vector3();
    const place = (dist: number) => {
      cam.position.copy(aim).addScaledVector(dir, dist);
      cam.lookAt(aim);
      cam.updateMatrixWorld();
    };
    const bounds = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        p.copy(c).project(cam);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      return { x0, x1, y0, y1 };
    };

    // Binary-search the distance, then shift the aim so the board is centred
    // in the free area; two passes are enough to converge.
    let dist = 20;
    for (let pass = 0; pass < 3; pass++) {
      let lo = 2, hi = 120;
      for (let i = 0; i < 40; i++) {
        dist = (lo + hi) / 2;
        place(dist);
        const b = bounds();
        const fits = b.x1 - b.x0 <= nx1 - nx0 && b.y1 - b.y0 <= ny1 - ny0;
        if (fits) hi = dist; else lo = dist;
      }
      dist = hi;
      place(dist);
      const b = bounds();
      const offX = (nx0 + nx1) / 2 - (b.x0 + b.x1) / 2;
      const offY = (ny0 + ny1) / 2 - (b.y0 + b.y1) / 2;
      // Convert the NDC offset into a world shift on the ground plane.
      const unitsPerNdcY = (Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * dist) / Math.sin(pitch);
      const unitsPerNdcX = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * dist * cam.aspect;
      aim = aim.clone().add(new THREE.Vector3(-offX * unitsPerNdcX, 0, offY * unitsPerNdcY));
    }
    place(dist);
    // Where the whole board, outer wall included, lands on screen (CSS px): the HUD keeps clear of it.
    const wallW = GRID_W / 2 + 1, wallD = GRID_H / 2 + 1;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1]) {
      p.set(sx * wallW, y, sz * wallD).project(cam);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    this.board = {
      left: ((x0 + 1) / 2) * viewW,
      right: ((x1 + 1) / 2) * viewW,
      top: ((1 - y1) / 2) * viewH,
      bottom: ((1 - y0) / 2) * viewH,
    };
    // In perspective the board is a trapezoid: its left outline runs from the far corner (high on
    // screen, further right) to the near corner (low, further left). The HUD panel sits up high.
    const corner = (sz: number) => {
      let x = Infinity, y = sz < 0 ? Infinity : -Infinity;
      for (const h of [0, 1]) {
        p.set(-wallW, h, sz * wallD).project(cam);
        x = Math.min(x, p.x);
        y = sz < 0 ? Math.min(y, -p.y) : Math.max(y, -p.y);
      }
      return { x: ((x + 1) / 2) * viewW, y: ((y + 1) / 2) * viewH };
    };
    const far = corner(-1), near = corner(1);
    this.leftEdge = { topX: far.x, topY: far.y, bottomX: near.x, bottomY: near.y };
    this.base.copy(cam.position);
    this.aim.copy(aim);
    this.dist = dist;
    this.dir.copy(dir);
    if (!this.focused) {
      this.look.copy(aim);
      this.lookGoal.copy(aim);
    }
  }

  /** Glides in on `point` (zoom < 1 = closer), or back to the normal view with null. */
  focus(point: THREE.Vector3 | null, zoom = 0.45): void {
    this.focused = point !== null;
    this.lookGoal.copy(point ?? this.aim);
    this.zoomGoal = point ? zoom : 1;
  }

  /** Jumps straight back to the normal view. */
  reset(): void {
    this.focus(null);
    this.look.copy(this.aim);
    this.zoom = 1;
  }

  /** An impact, strength 0..1. Several in one frame: the strongest counts, they don't add up. */
  shake(strength = 1): void {
    this.shakeAsk = Math.max(this.shakeAsk, Math.min(1, strength));
  }

  update(dt: number): void {
    // A new impact restarts the impulse only if it beats what is left of the current one.
    if (this.shakeOn && this.shakeAsk > 0) {
      const left = this.shakeT < SHAKE_END ? this.shakeAmp * Math.exp(-this.shakeT / SHAKE_DECAY) : 0;
      if (this.shakeAsk > left) {
        this.shakeAmp = this.shakeAsk;
        this.shakeT = 0;
      }
    }
    this.shakeAsk = 0;
    const off = this.shakeOn ? shakeOffset(this.shakeAmp, this.shakeT) : 0;
    this.shakeT += dt;
    const k = 1 - Math.exp(-4 * dt);
    this.look.lerp(this.lookGoal, k);
    this.zoom += (this.zoomGoal - this.zoom) * k;
    const moved = this.zoom < 0.999 || this.look.distanceToSquared(this.aim) > 1e-6;
    // Normal view: the fitted position. Close-up: same angle, nearer, aimed at the point.
    if (moved) this.camera.position.copy(this.look).addScaledVector(this.dir, this.dist * this.zoom);
    else this.camera.position.copy(this.base);
    this.camera.lookAt(moved ? this.look : this.aim);
    // Added after positioning, recomputed every frame and never stored: the camera ends exactly where it was.
    if (off !== 0) {
      this.camera.position.x += off;
      this.camera.position.z += off * 0.6;
      this.camera.rotateZ(off * 0.15); // a tiny roll
    }
  }
}
