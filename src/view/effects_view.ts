import * as THREE from 'three';
import { BEAM_FADE_TICKS, FUSE_TICKS, TICK_RATE } from '../sim/constants';
import type { Charge, GameState } from '../sim/state';
import { tileToWorld } from './coords';

// Plasma Charges, beams and debris. Reads sim state each frame; never writes it.
// Placeholder look: swap the geometries/materials here for real models later.

import { BEAM_CORE, PLASMA } from './play_colors';

export class ChargesView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();
  private geo = new THREE.SphereGeometry(0.3, 24, 16);

  /** `extra`: charges not in the state yet (your own, predicted online); drawn under negative ids. */
  sync(state: GameState, extra: readonly Charge[] = []): void {
    const seen = new Set<number>();
    const ghosts = extra.map((c) => ({ ...c, id: -1 - (c.ty * state.grid.w + c.tx) }));
    for (const c of ghosts.length ? [...state.charges, ...ghosts] : state.charges) {
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

/**
 * Beams drawn as thin bars along each arm of the cross, so the glow stays
 * inside the tiles the beam actually covers (range 2 = 2 tiles each way).
 */
export class BeamsView {
  readonly group = new THREE.Group();
  private outer: THREE.InstancedMesh;
  private core: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(maxTiles: number) {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    this.outer = new THREE.InstancedMesh(
      unit,
      new THREE.MeshBasicMaterial({ color: PLASMA, transparent: true, opacity: 0.55, depthWrite: false }),
      maxTiles * 2,
    );
    this.core = new THREE.InstancedMesh(unit, new THREE.MeshBasicMaterial({ color: BEAM_CORE }), maxTiles * 2);
    this.outer.count = this.core.count = 0;
    this.group.add(this.outer, this.core);
  }

  sync(state: GameState): void {
    const { beams, grid } = state;
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < grid.w && y < grid.h && beams[y * grid.w + x] > 0;
    let n = 0;
    const bar = (cx: number, cy: number, x0: number, x1: number, z0: number, z1: number, k: number) => {
      // Outer glow and a thinner bright core: full size while the beam is
      // dangerous, then shrinking to nothing during the harmless fade-out.
      for (const [mesh, thick, h] of [[this.outer, 0.46, 0.22], [this.core, 0.2, 0.26]] as const) {
        const w = Math.max(0.001, thick * k);
        const sx = x1 - x0 === 0 ? w : x1 - x0;
        const sz = z1 - z0 === 0 ? w : z1 - z0;
        tileToWorld(cx, cy, 0.18, this.pos);
        this.pos.x += (x0 + x1) / 2;
        this.pos.z += (z0 + z1) / 2;
        this.s.set(sx, Math.max(0.001, h * k), sz);
        this.m.compose(this.pos, this.q, this.s);
        mesh.setMatrixAt(n, this.m);
      }
      n++;
    };
    for (let i = 0; i < beams.length; i++) {
      if (beams[i] === 0) continue;
      const x = i % grid.w, y = Math.floor(i / grid.w);
      const k = Math.min(1, beams[i] / BEAM_FADE_TICKS);
      const l = at(x - 1, y), r = at(x + 1, y), u = at(x, y - 1), d = at(x, y + 1);
      const tip = 0.32; // a beam end stops short of the tile edge
      if (l || r || !(u || d)) bar(x, y, l ? -0.5 : -tip, r ? 0.5 : tip, 0, 0, k);
      if (u || d) bar(x, y, 0, 0, u ? -0.5 : -tip, d ? 0.5 : tip, k);
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
