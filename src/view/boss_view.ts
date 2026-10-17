import * as THREE from 'three';
import { bossWarning, crossTiles } from '../sim/boss';
import { BossKind } from '../sim/constants';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';

// Placeholder boss: a pulsing dome on the centre tile, coloured per boss, with
// a spinning ring. It pulses faster while a wave is being announced.

const BOSS_COLOR: Record<number, number> = {
  [BossKind.GooplingHive]: 0x6fd14f,
  [BossKind.DarknessHive]: 0x7a4cff,
  [BossKind.MazeMaster]: 0xff8a3d,
};

export class BossView {
  readonly group = new THREE.Group();
  private mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.35 });
  private dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), this.mat);
  private ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  private eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));

  constructor() {
    this.dome.castShadow = true;
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.3;
    this.eye.position.set(0, 0.55, 0.45);
    this.group.add(this.dome, this.ring, this.eye);
    this.group.visible = false;
  }

  sync(state: GameState, time: number): void {
    const b = state.boss;
    this.group.visible = !!b && b.alive;
    if (!b || !b.alive) return;
    tileToWorld(b.tile % state.grid.w, Math.floor(b.tile / state.grid.w), 0, this.group.position);
    const color = BOSS_COLOR[b.kind] ?? 0xffffff;
    this.mat.color.setHex(color);
    this.mat.emissive.setHex(color);
    const warning = bossWarning(state);
    const pulse = 0.5 + 0.5 * Math.sin(time * (warning ? 14 : 3));
    this.mat.emissiveIntensity = 0.2 + (warning ? 0.8 : 0.3) * pulse;
    this.dome.scale.set(1 + 0.05 * pulse, 0.9 + 0.15 * pulse, 1 + 0.05 * pulse);
    this.ring.rotation.z = time * (warning ? 4 : 1);
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
