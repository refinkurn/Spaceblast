import * as THREE from 'three';
import { Cell, Item } from '../sim/constants';
import { gateOpen } from '../sim/items';
import type { GameState, Martian } from '../sim/state';
import { tileToWorld, toWorld } from './coords';

// Power-ups, the Warp Gate and Martians. Placeholder shapes, one colour and
// silhouette per kind, so real models can replace them one by one later.

/** Colour and shape per power-up, also used by the HUD legend. */
export const ITEM_LOOK: Record<number, { name: string; color: number }> = {
  [Item.BeamRange]: { name: 'Beam Range+', color: 0xff9a3c },
  [Item.ExtraCharge]: { name: 'Extra Charge', color: 0x5ad1ff },
  [Item.JetBoots]: { name: 'Jet Boots', color: 0x7dff8a },
  [Item.FreezePulse]: { name: 'Freeze Pulse', color: 0xb9a4ff },
  [Item.OxygenVest]: { name: 'Oxygen Vest', color: 0xffffff },
};

const ITEM_GEOMETRY: Record<number, THREE.BufferGeometry> = {
  [Item.BeamRange]: new THREE.ConeGeometry(0.2, 0.42, 16),
  [Item.ExtraCharge]: new THREE.SphereGeometry(0.2, 16, 12),
  [Item.JetBoots]: new THREE.BoxGeometry(0.3, 0.3, 0.3),
  [Item.FreezePulse]: new THREE.OctahedronGeometry(0.25),
  [Item.OxygenVest]: new THREE.TorusGeometry(0.18, 0.07, 10, 20),
};

export class ItemsView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Mesh>();
  private materials = new Map<number, THREE.Material>();

  sync(state: GameState, time: number): void {
    const { grid, items } = state;
    const seen = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === Item.None || grid.cells[i] !== Cell.Empty) continue;
      const key = i * 8 + item;
      seen.add(key);
      let m = this.meshes.get(key);
      if (!m) {
        let mat = this.materials.get(item);
        if (!mat) this.materials.set(item, (mat = new THREE.MeshStandardMaterial({ color: ITEM_LOOK[item].color, emissive: ITEM_LOOK[item].color, emissiveIntensity: 0.45, roughness: 0.4 })));
        m = new THREE.Mesh(ITEM_GEOMETRY[item], mat);
        m.castShadow = true;
        tileToWorld(i % grid.w, Math.floor(i / grid.w), 0, m.position);
        this.meshes.set(key, m);
        this.group.add(m);
      }
      m.position.y = 0.42 + Math.sin(time * 3 + i) * 0.06;
      m.rotation.y = time * 1.6 + i;
    }
    for (const [key, m] of this.meshes) {
      if (seen.has(key)) continue;
      this.group.remove(m);
      this.meshes.delete(key);
    }
  }

  clear(): void {
    this.meshes.clear();
    this.group.clear();
  }
}

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
    tileToWorld(gate % grid.w, Math.floor(gate / grid.w), 0.08, this.group.position);
    const open = gateOpen(state);
    const mat = this.ring.material as THREE.MeshStandardMaterial;
    mat.color.setHex(open ? 0x7dffd8 : 0x6d5a8f);
    mat.emissive.setHex(open ? 0x7dffd8 : 0x6d5a8f);
    mat.emissiveIntensity = open ? 0.8 + 0.4 * Math.sin(time * 5) : 0.2;
    (this.disc.material as THREE.MeshBasicMaterial).opacity = open ? 0.35 + 0.15 * Math.sin(time * 5) : 0;
    this.ring.rotation.z = time * (open ? 2.5 : 0.4);
  }
}

/** Goopling placeholder: a green jelly blob with two eye stalks. */
function makeGoopling(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0x6fd14f, roughness: 0.35, emissive: 0x1e4a12, emissiveIntensity: 0.4 }),
  );
  body.name = 'body';
  body.scale.set(1, 0.72, 1);
  body.position.y = 0.26;
  body.castShadow = true;
  g.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x220a33 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), eyeMat);
    eye.position.set(side * 0.13, 0.55, -0.12);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pupilMat);
    pupil.position.set(0, 0, -0.07);
    eye.add(pupil);
    g.add(eye);
  }
  return g;
}

export class MartiansView {
  readonly group = new THREE.Group();
  private views = new Map<number, THREE.Group>();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();

  sync(state: GameState, prev: Map<number, { x: number; y: number }>, alpha: number, time: number): void {
    for (const m of state.martians) {
      let v = this.views.get(m.id);
      if (!v) {
        v = makeGoopling();
        this.views.set(m.id, v);
        this.group.add(v);
      }
      v.visible = m.alive;
      if (!m.alive) continue;
      const p = prev.get(m.id) ?? m;
      toWorld(p.x, p.y, 0, this.from);
      toWorld(m.x, m.y, 0, this.to);
      v.position.lerpVectors(this.from, this.to, alpha);
      this.face(v, m);
      const frozen = state.freeze > 0;
      const body = v.getObjectByName('body') as THREE.Mesh;
      const wobble = frozen ? 0 : Math.sin(time * 9 + m.id * 2) * 0.08;
      body.scale.set(1 + wobble, 0.72 - wobble, 1 + wobble);
      (body.material as THREE.MeshStandardMaterial).color.setHex(frozen ? 0x9fd8ff : 0x6fd14f);
    }
  }

  private face(v: THREE.Group, m: Martian) {
    const yaw = [0, 0, Math.PI, Math.PI / 2, -Math.PI / 2][m.dir];
    v.rotation.y = yaw;
  }

  clear(): void {
    this.views.clear();
    this.group.clear();
  }
}
