import * as THREE from 'three';
import { FROZEN, GATE_OPEN, MARTIAN_COLOR } from './play_colors';
import { SLAP_SECONDS, animateMartian, makeMartian, type MartianParts } from './martian_mesh';
import { Cell, Kind, LevelEvent, PORTAL_TICKS, TILE } from '../sim/constants';
import { gateOpen } from '../sim/items';
import type { GameState, Martian } from '../sim/state';
import { tileToWorld, toWorld } from './coords';
import { gateFlicker } from './level_view';

// Power-ups, the Warp Gate and Martians. Placeholder shapes, one colour and
// silhouette per kind, so real models can replace them one by one later.

export class GateView {
  readonly group = new THREE.Group();
  private ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.07, 12, 32),
    new THREE.MeshStandardMaterial({ color: 0x6d5a8f, emissive: 0x6d5a8f, emissiveIntensity: 0.2 }),
  );
  private disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 32),
    new THREE.MeshBasicMaterial({ color: 0x7dffd8, transparent: true, opacity: 0 }),
  );

  constructor() {
    this.ring.rotation.x = -Math.PI / 2;
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.02;
    this.group.add(this.ring, this.disc);
    this.group.visible = false;
  }

  sync(state: GameState, time: number): void {
    const { gate, grid } = state;
    this.group.visible = gate >= 0 && grid.cells[gate] === Cell.Empty;
    if (!this.group.visible) return;
    // About to move: blink faster and faster.
    const f = gateFlicker(state);
    if (f > 0 && Math.sin(time * (8 + 30 * f)) < 0) this.group.visible = false;
    tileToWorld(gate % grid.w, Math.floor(gate / grid.w), 0.08, this.group.position);
    const open = gateOpen(state);
    const mat = this.ring.material as THREE.MeshStandardMaterial;
    mat.color.setHex(open ? GATE_OPEN : 0x6d5a8f);
    mat.emissive.setHex(open ? GATE_OPEN : 0x6d5a8f);
    mat.emissiveIntensity = open ? 0.8 + 0.4 * Math.sin(time * 5) : 0.2;
    (this.disc.material as THREE.MeshBasicMaterial).opacity = open ? 0.35 + 0.15 * Math.sin(time * 5) : 0;
    this.ring.rotation.z = time * (open ? 2.5 : 0.4);
  }
}


/** A dark swirl over a hidden Phaser's burrow, so players can see where it will come from. */
function makeBurrow(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), new THREE.MeshBasicMaterial({ color: 0x2a1840, transparent: true, opacity: 0.8 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

export class MartiansView {
  readonly group = new THREE.Group();
  private views = new Map<number, THREE.Group>();
  private burrows = new Map<number, THREE.Mesh>();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  /** Builder claw slaps: martian id -> view time the slap started. */
  private slaps = new Map<number, number>();
  private now = 0;

  /** A rock was built at (tx, ty): the Builder next to it slaps its claws. */
  slapNear(state: GameState, tx: number, ty: number): void {
    let best: Martian | null = null;
    let bestD = 3;
    for (const m of state.martians) {
      if (!m.alive || m.kind !== Kind.Builder) continue;
      const d = Math.abs(Math.round(m.x / TILE) - tx) + Math.abs(Math.round(m.y / TILE) - ty);
      if (d < bestD) { best = m; bestD = d; }
    }
    if (best) this.slaps.set(best.id, this.now);
  }

  sync(state: GameState, prev: Map<number, { x: number; y: number }>, alpha: number, time: number): void {
    this.now = time;
    for (const m of state.martians) {
      let v = this.views.get(m.id);
      if (!v) {
        v = makeMartian(m.kind);
        this.views.set(m.id, v);
        this.group.add(v);
      }
      let burrow = this.burrows.get(m.id);
      if (m.kind === Kind.Phaser && !burrow) {
        burrow = makeBurrow();
        this.burrows.set(m.id, burrow);
        this.group.add(burrow);
      }
      if (burrow) {
        burrow.visible = m.alive && m.hidden;
        toWorld(m.x, m.y, 0.02, burrow.position);
        burrow.rotation.z = time * 3;
      }
      v.visible = m.alive && !m.hidden;
      if (!v.visible) continue;
      const p = prev.get(m.id) ?? m;
      toWorld(p.x, p.y, 0, this.from);
      toWorld(m.x, m.y, 0, this.to);
      v.position.lerpVectors(this.from, this.to, alpha);
      this.face(v, m);
      const frozen = state.freeze > 0;
      const parts = v.userData.parts as MartianParts;
      // Goopling jelly wobbles most; the others breathe a little.
      const amp = m.kind === Kind.Goopling ? 0.08 : 0.03;
      const wobble = frozen ? 0 : Math.sin(time * 9 + m.id * 2) * amp;
      parts.body.scale.set(1 + wobble, 1 - wobble, 1 + wobble);
      if (m.kind === Kind.Phaser) v.position.y = 0.06 + Math.sin(time * 3 + m.id) * 0.05; // hovers
      const slapStart = this.slaps.get(m.id);
      const slap = slapStart === undefined ? 0 : (time - slapStart) / SLAP_SECONDS;
      if (slap >= 1) this.slaps.delete(m.id);
      animateMartian(m.kind, parts, time, m.id * 1.7, p.x !== m.x || p.y !== m.y, frozen, slap > 0 && slap < 1 ? slap : 0);
      parts.skin.color.setHex(frozen ? FROZEN : MARTIAN_COLOR[m.kind]);
      // In a Blackout only the eyes should give a Martian away.
      parts.skin.emissiveIntensity = state.event === LevelEvent.Blackout && state.eventActive > 0 ? 0 : 0.15;
    }
  }

  private face(v: THREE.Group, m: Martian) {
    const yaw = [0, 0, Math.PI, Math.PI / 2, -Math.PI / 2][m.dir];
    v.rotation.y = yaw;
  }

  clear(): void {
    this.views.clear();
    this.burrows.clear();
    this.slaps.clear();
    this.group.clear();
  }
}

/** Phaser portal pairs: a ring at each end that shrinks as the portal closes. */
export class PortalsView {
  readonly group = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  private geo = new THREE.TorusGeometry(0.38, 0.06, 10, 28);
  private mat = new THREE.MeshBasicMaterial({ color: 0xb48cff });

  sync(state: GameState, time: number): void {
    const ends = state.portals.flatMap((p) => [[p.from, p.ticks], [p.to, p.ticks]]);
    while (this.rings.length < ends.length) {
      const r = new THREE.Mesh(this.geo, this.mat);
      r.rotation.x = -Math.PI / 2;
      this.rings.push(r);
      this.group.add(r);
    }
    this.rings.forEach((r, i) => {
      r.visible = i < ends.length;
      if (!r.visible) return;
      const [tile, ticks] = ends[i];
      tileToWorld(tile % state.grid.w, Math.floor(tile / state.grid.w), 0.06, r.position);
      r.scale.setScalar(0.4 + 0.6 * (ticks / PORTAL_TICKS));
      r.rotation.z = time * 4 * (i % 2 === 0 ? 1 : -1);
    });
  }
}
