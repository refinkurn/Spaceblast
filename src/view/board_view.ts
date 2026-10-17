import * as THREE from 'three';
import { Cell } from '../sim/constants';
import { cellAt } from '../sim/grid';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';

// Draws the arena with one InstancedMesh per kind of tile (a handful of draw
// calls in total, which matters on phones). Reads sim state, never writes it.

const PALETTE = {
  floorA: 0xb4553a,
  floorB: 0xa64d35,
  pillar: 0x3b3f4a,
  border: 0x2a2d35,
  rock: 0xd9773f,
  collapse: 0x5b4652,
};

/** A collapse block falls from this height in FALL_SECONDS. */
const FALL_FROM = 6;
const FALL_SECONDS = 0.18;

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export class BoardView {
  readonly group = new THREE.Group();
  /** One rock instance per grid cell (hidden when there is no rock), so rocks can come and go. */
  private rockMesh?: THREE.InstancedMesh;
  /** One collapse block per cell (Battle "Hurry Up"), hidden until it falls. */
  private collapseMesh?: THREE.InstancedMesh;
  private falling: { i: number; tx: number; ty: number; t: number }[] = [];
  private width = 0;

  build(state: GameState): void {
    this.dispose();
    const { w, h } = state.grid;
    const pillars: [number, number][] = [];
    const rocks: [number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = cellAt(state.grid, x, y);
        // The boss tile is solid in the sim, but the boss model stands there instead of a pillar.
        if (c === Cell.Pillar && y * w + x !== state.boss?.tile) pillars.push([x, y]);
        else if (c === Cell.Rock) rocks.push([x, y]);
      }
    }
    const border: [number, number][] = [];
    for (let x = -1; x <= w; x++) border.push([x, -1], [x, h]);
    for (let y = 0; y < h; y++) border.push([-1, y], [w, y]);

    this.group.add(this.floor(w, h));
    this.group.add(this.cubes(pillars, 1.0, PALETTE.pillar));
    this.group.add(this.cubes(border, 1.0, PALETTE.border));
    const allCells: [number, number][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) allCells.push([x, y]);
    this.rockMesh = this.cubes(allCells, 0.88, PALETTE.rock);
    this.width = w;
    for (const [x, y] of allCells) if (!rocks.some(([rx, ry]) => rx === x && ry === y)) this.breakRock(x, y);
    this.group.add(this.rockMesh);
    this.collapseMesh = this.cubes(allCells, 1.0, PALETTE.collapse);
    for (let i = 0; i < allCells.length; i++) this.collapseMesh.setMatrixAt(i, HIDDEN);
    this.group.add(this.collapseMesh);
    this.falling = [];
  }

  /** The arena collapse: a block falls onto (tx, ty); the sim has already made it solid. */
  dropBlock(tx: number, ty: number): void {
    this.breakRock(tx, ty);
    this.falling.push({ i: ty * this.width + tx, tx, ty, t: 0 });
  }

  /** Animates falling blocks. */
  update(dt: number): void {
    if (!this.collapseMesh || this.falling.length === 0) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    for (const f of this.falling) {
      f.t = Math.min(1, f.t + dt / FALL_SECONDS);
      this.collapseMesh.setMatrixAt(f.i, m.makeTranslation(tileToWorld(f.tx, f.ty, 0.5 + FALL_FROM * (1 - f.t) ** 2, pos)));
    }
    this.collapseMesh.instanceMatrix.needsUpdate = true;
    this.falling = this.falling.filter((f) => f.t < 1);
  }

  /** Hides a rock the sim has broken. */
  breakRock(tx: number, ty: number): void {
    if (!this.rockMesh) return;
    this.rockMesh.setMatrixAt(ty * this.width + tx, HIDDEN);
    this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  /** Shows a rock the sim has added (Builder, Maze Shift). */
  addRock(tx: number, ty: number): void {
    if (!this.rockMesh) return;
    this.rockMesh.setMatrixAt(ty * this.width + tx, new THREE.Matrix4().makeTranslation(tileToWorld(tx, ty, 0.44)));
    this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  private floor(w: number, h: number): THREE.InstancedMesh {
    const geo = new THREE.BoxGeometry(1, 0.1, 1);
    const mat = new THREE.MeshLambertMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, w * h);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const color = new THREE.Color();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        mesh.setMatrixAt(i, m.makeTranslation(tileToWorld(x, y, -0.05, pos)));
        mesh.setColorAt(i, color.setHex((x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB));
      }
    }
    mesh.receiveShadow = true;
    return mesh;
  }

  private cubes(tiles: [number, number][], size: number, color: number): THREE.InstancedMesh {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(tiles.length, 1));
    mesh.count = tiles.length;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    tiles.forEach(([x, y], i) => mesh.setMatrixAt(i, m.makeTranslation(tileToWorld(x, y, size / 2, pos))));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  dispose(): void {
    for (const child of [...this.group.children]) {
      const mesh = child as THREE.InstancedMesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.group.remove(mesh);
    }
  }
}
