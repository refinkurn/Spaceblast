import * as THREE from 'three';
import { BEAM_TICKS, FUSE_TICKS, TICK_RATE } from '../sim/constants';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';

// Plasma Charges, beams and debris. Reads sim state each frame; never writes it.
// Placeholder look: swap the geometries/materials here for real models later.

const PLASMA = 0x5ad1ff;

export class ChargesView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();
  private geo = new THREE.SphereGeometry(0.3, 24, 16);

  sync(state: GameState): void {
    const seen = new Set<number>();
    for (const c of state.charges) {
      seen.add(c.id);
      let m = this.meshes.get(c.id);
      if (!m) {
        m = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ color: 0x1b3550, emissive: PLASMA, emissiveIntensity: 0.6, roughness: 0.3 }));
        m.castShadow = true;
        tileToWorld(c.tx, c.ty, 0.32, m.position);
        this.meshes.set(c.id, m);
        this.group.add(m);
      }
      // Pulse speeds up as the fuse burns: phase grows with elapsed time squared.
      const t = (FUSE_TICKS - c.fuse) / TICK_RATE;
      const phase = Math.PI * 2 * (1.2 * t + 1.6 * t * t);
      const pulse = 0.5 + 0.5 * Math.sin(phase);
      m.scale.setScalar(1 + 0.12 * pulse);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + 1.4 * pulse;
    }
    for (const [id, m] of this.meshes) {
      if (seen.has(id)) continue;
      (m.material as THREE.Material).dispose();
      this.group.remove(m);
      this.meshes.delete(id);
    }
  }

  clear(): void {
    for (const m of this.meshes.values()) (m.material as THREE.Material).dispose();
    this.meshes.clear();
    this.group.clear();
  }
}

export class BeamsView {
  readonly group = new THREE.Group();
  private outer: THREE.InstancedMesh;
  private core: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(maxTiles: number) {
    this.outer = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.96, 0.5, 0.96),
      new THREE.MeshBasicMaterial({ color: PLASMA, transparent: true, opacity: 0.45, depthWrite: false }),
      maxTiles,
    );
    this.core = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.6, 0.3, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xe9fbff }),
      maxTiles,
    );
    this.outer.count = this.core.count = 0;
    this.group.add(this.outer, this.core);
  }

  sync(state: GameState): void {
    const { beams, grid } = state;
    let n = 0;
    for (let i = 0; i < beams.length; i++) {
      const left = beams[i];
      if (left === 0) continue;
      const k = left / BEAM_TICKS; // 1 when fresh, fades to 0
      tileToWorld(i % grid.w, Math.floor(i / grid.w), 0.25, this.pos);
      this.s.set(0.7 + 0.3 * k, 0.4 + 0.6 * k, 0.7 + 0.3 * k);
      this.m.compose(this.pos, this.q, this.s);
      this.outer.setMatrixAt(n, this.m);
      this.core.setMatrixAt(n, this.m);
      n++;
    }
    this.outer.count = this.core.count = n;
    this.outer.instanceMatrix.needsUpdate = this.core.instanceMatrix.needsUpdate = true;
  }
}

interface Chunk {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

/** Small flying cubes for broken rocks and knocked-out astronauts. */
export class DebrisView {
  readonly group = new THREE.Group();
  private chunks: Chunk[] = [];
  private geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private materials = new Map<number, THREE.Material>();

  burst(tx: number, ty: number, color: number, count = 8): void {
    let mat = this.materials.get(color);
    if (!mat) this.materials.set(color, (mat = new THREE.MeshLambertMaterial({ color })));
    const origin = tileToWorld(tx, ty, 0.4);
    for (let i = 0; i < count; i++) {
      // Math.random is fine here: debris is cosmetic and never feeds back into the sim.
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.position.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      this.chunks.push({ mesh, vel: new THREE.Vector3(Math.cos(a) * speed, 3 + Math.random() * 2.5, Math.sin(a) * speed), life: 0.7 });
      this.group.add(mesh);
    }
  }

  update(dt: number): void {
    for (const c of this.chunks) {
      c.life -= dt;
      c.vel.y -= 12 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += dt * 8;
      c.mesh.rotation.z += dt * 6;
      c.mesh.scale.setScalar(Math.max(c.life / 0.7, 0.01));
    }
    const dead = this.chunks.filter((c) => c.life <= 0 || c.mesh.position.y < -0.2);
    for (const c of dead) this.group.remove(c.mesh);
    this.chunks = this.chunks.filter((c) => !dead.includes(c));
  }
}
