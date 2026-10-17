import * as THREE from 'three';
import { GRID_H, GRID_W } from '../sim/constants';

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
  private shakeLeft = 0;
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

  shake(seconds = 0.18): void {
    this.shakeLeft = Math.max(this.shakeLeft, seconds);
  }

  update(dt: number): void {
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    const a = this.shakeLeft > 0 ? 0.06 : 0;
    const k = 1 - Math.exp(-4 * dt);
    this.look.lerp(this.lookGoal, k);
    this.zoom += (this.zoomGoal - this.zoom) * k;
    const moved = this.zoom < 0.999 || this.look.distanceToSquared(this.aim) > 1e-6;
    // Normal view: the fitted position. Close-up: same angle, nearer, aimed at the point.
    if (moved) this.camera.position.copy(this.look).addScaledVector(this.dir, this.dist * this.zoom);
    else this.camera.position.copy(this.base);
    this.camera.lookAt(moved ? this.look : this.aim);
    this.camera.position.x += (Math.random() - 0.5) * a;
    this.camera.position.y += (Math.random() - 0.5) * a;
    this.camera.position.z += (Math.random() - 0.5) * a;
  }
}
