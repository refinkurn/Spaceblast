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
};

export class BoardView {
  readonly group = new THREE.Group();
  private rockMesh?: THREE.InstancedMesh;
  /** Grid cell index -> rock instance index. */
  private rockIndex = new Map<number, number>();
  private width = 0;

  build(state: GameState): void {
    this.dispose();
    const { w, h } = state.grid;
    const pillars: [number, number][] = [];
    const rocks: [number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = cellAt(state.grid, x, y);
        if (c === Cell.Pillar) pillars.push([x, y]);
        else if (c === Cell.Rock) rocks.push([x, y]);
      }
    }
    const border: [number, number][] = [];
    for (let x = -1; x <= w; x++) border.push([x, -1], [x, h]);
    for (let y = 0; y < h; y++) border.push([-1, y], [w, y]);

    this.group.add(this.floor(w, h));
    this.group.add(this.cubes(pillars, 1.0, PALETTE.pillar));
    this.group.add(this.cubes(border, 1.0, PALETTE.border));
    this.rockMesh = this.cubes(rocks, 0.88, PALETTE.rock);
    this.rockIndex = new Map(rocks.map(([x, y], i) => [y * w + x, i]));
    this.width = w;
    this.group.add(this.rockMesh);
  }

  /** Hides a rock the sim has broken. */
  breakRock(tx: number, ty: number): void {
    const i = this.rockIndex.get(ty * this.width + tx);
    if (i === undefined || !this.rockMesh) return;
    this.rockMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.rockMesh.instanceMatrix.needsUpdate = true;
    this.rockIndex.delete(ty * this.width + tx);
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
