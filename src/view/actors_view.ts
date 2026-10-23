import * as THREE from 'three';
import { FROZEN, GATE_OPEN, MARTIAN_COLOR } from './play_colors';
import { Cell, Kind, LevelEvent, PORTAL_TICKS } from '../sim/constants';
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


function eyes(g: THREE.Group, y: number, spread: number, z: number) {
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x220a33 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), eyeMat);
    eye.position.set(side * spread, y, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pupilMat);
    pupil.position.set(0, 0, -0.07);
    eye.add(pupil);
    g.add(eye);
  }
}

/** Placeholder Martians, one silhouette per kind: blob, nosy blob, ghost, block. */
function makeMartian(kind: number): THREE.Group {
  const g = new THREE.Group();
  const color = MARTIAN_COLOR[kind];
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.15 });
  let body: THREE.Mesh;
  if (kind === Kind.Builder) {
    body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.56), mat);
    body.position.y = 0.27;
    eyes(g, 0.42, 0.13, -0.28);
  } else if (kind === Kind.Phaser) {
    mat.transparent = true;
    mat.opacity = 0.78;
    body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 6, 16), mat);
    body.position.y = 0.4;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24), new THREE.MeshBasicMaterial({ color: 0xc9d0ff }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.82;
    g.add(halo);
    eyes(g, 0.5, 0.1, -0.2);
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(kind === Kind.Sniffer ? 0.3 : 0.34, 20, 14), mat);
    body.scale.set(1, 0.72, 1);
    body.position.y = 0.26;
    eyes(g, 0.55, 0.13, -0.12);
    if (kind === Kind.Sniffer) {
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xe0b3ff }));
      nose.rotation.x = -Math.PI / 2;
      nose.position.set(0, 0.32, -0.36);
      g.add(nose);
    }
  }
  body.name = 'body';
  body.castShadow = true;
  g.add(body);
  return g;
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

  sync(state: GameState, prev: Map<number, { x: number; y: number }>, alpha: number, time: number): void {
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
      const body = v.getObjectByName('body') as THREE.Mesh;
      const wobble = frozen ? 0 : Math.sin(time * 9 + m.id * 2) * 0.08;
      const squash = m.kind === Kind.Goopling || m.kind === Kind.Sniffer ? 0.72 : 1;
      body.scale.set(1 + wobble, squash - wobble, 1 + wobble);
      if (m.kind === Kind.Phaser) v.position.y = 0.06 + Math.sin(time * 3 + m.id) * 0.05; // hovers
      const mat = body.material as THREE.MeshStandardMaterial;
      mat.color.setHex(frozen ? FROZEN : MARTIAN_COLOR[m.kind]);
      // In a Blackout only the eyes should give a Martian away.
      mat.emissiveIntensity = state.event === LevelEvent.Blackout && state.eventActive > 0 ? 0 : 0.15;
    }
  }

  private face(v: THREE.Group, m: Martian) {
    const yaw = [0, 0, Math.PI, Math.PI / 2, -Math.PI / 2][m.dir];
    v.rotation.y = yaw;
  }

  clear(): void {
    this.views.clear();
    this.burrows.clear();
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
