import * as THREE from 'three';
import { bossWarning, crossTiles } from '../sim/boss';
import { BossKind } from '../sim/constants';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';
import { animateBoss, makeBoss, type BossParts } from './boss_mesh';

// The boss on the centre tile: a low-poly hive or the Maze Master
// (view/boss_mesh.ts), built when its kind first shows up. It pulses, faster
// while a wave is being announced.

export class BossView {
  readonly group = new THREE.Group();
  private parts: BossParts | null = null;
  private kind = -1;

  constructor() {
    this.group.visible = false;
  }

  sync(state: GameState, time: number): void {
    const b = state.boss;
    this.group.visible = !!b && b.alive;
    if (!b || !b.alive) return;
    if (b.kind !== this.kind) {
      this.group.clear();
      this.parts = makeBoss(b.kind);
      this.group.add(this.parts.root);
      this.kind = b.kind;
    }
    tileToWorld(b.tile % state.grid.w, Math.floor(b.tile / state.grid.w), 0, this.group.position);
    const warning = bossWarning(state);
    const pulse = 0.5 + 0.5 * Math.sin(time * (warning ? 14 : 3));
    if (this.parts) animateBoss(b.kind, this.parts, time, pulse, warning);
  }
}

/** During the Maze Master's warning, the row and column its cross blast will hit pulse red. */
export class CrossPreviewView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private pos = new THREE.Vector3();

  constructor(maxTiles: number) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.94, 0.06, 0.94),
      new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.4, depthWrite: false }),
      maxTiles,
    );
    this.mesh.count = 0;
    this.group.add(this.mesh);
  }

  sync(state: GameState, time: number): void {
    const b = state.boss;
    const show = !!b && b.kind === BossKind.MazeMaster && bossWarning(state);
    const tiles = show && b ? crossTiles(state, b) : [];
    this.mesh.count = tiles.length;
    tiles.forEach((i, n) => {
      tileToWorld(i % state.grid.w, Math.floor(i / state.grid.w), 0.04, this.pos);
      this.mesh.setMatrixAt(n, this.m.makeTranslation(this.pos));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.3 * Math.abs(Math.sin(time * 9));
  }
}
