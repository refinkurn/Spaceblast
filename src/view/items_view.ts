import * as THREE from 'three';
import { Cell, Item } from '../sim/constants';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';
import { ITEM_LOOK, itemBody, shellMesh } from './item_look';
import { ParticlePool } from './particles';

// Power-ups on the grid: a low-poly item floating in a clear glass shell, and
// bursts from one shared particle pool when an item appears or is picked up.
// No floor glow or idle sparkles: in the item's colour they read as a second
// object (or a danger tile), so only the item itself carries the colour.
// View only; reads the state, never writes it.

/** Power-ups are drawn this much bigger than their meshes (playtest: too small to notice). */
export const ITEM_SCALE = 1.6;
/** Float height inside the scaled item (about 0.4 above the floor). */
const FLOAT = 0.25;
const SPIN = (30 * Math.PI) / 180; // rad/s
const POP_SECONDS = 0.2;

interface Entry {
  root: THREE.Group;
  body: THREE.Group;
  item: number;
  tx: number;
  ty: number;
  born: number;
}

export class ItemsView {
  readonly group = new THREE.Group();
  readonly particles = new ParticlePool();
  /** Set by the game view when AdaptiveQuality has stepped down (items are already light; kept for the view's wiring). */
  reduced = false;
  private entries = new Map<number, Entry>();
  private lastTime = -1;
  private primed = false;

  constructor() {
    this.group.add(this.particles.points);
  }

  sync(state: GameState, time: number): void {
    const dt = this.lastTime < 0 ? 0 : Math.min(Math.max(time - this.lastTime, 0), 0.1);
    this.lastTime = time;
    const { grid, items } = state;
    const seen = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === Item.None || grid.cells[i] !== Cell.Empty) continue;
      const key = i * 8 + item;
      seen.add(key);
      let e = this.entries.get(key);
      if (!e) {
        const tx = i % grid.w;
        const ty = Math.floor(i / grid.w);
        e = this.create(item, tx, ty, time);
        this.entries.set(key, e);
        // A power-up appearing after the first look: small burst (the first sync just shows what is there).
        if (this.primed) this.burstAt(e, 8);
      }
      const phase = e.tx * 1.7 + e.ty * 2.3;
      e.body.position.y = FLOAT + Math.sin(time * Math.PI + phase) * 0.05; // about 1 cycle per 2 s
      e.body.rotation.y = time * SPIN + phase;
      const shell = e.root.children[1];
      shell.position.y = e.body.position.y;
      const pop = Math.min(1, (time - e.born) / POP_SECONDS);
      e.root.scale.setScalar(Math.max(pop, 0.001) * ITEM_SCALE);
    }
    // Gone from the grid (picked up): a burst in its colour.
    for (const [key, e] of this.entries) {
      if (seen.has(key)) continue;
      this.burstAt(e, 10);
      this.group.remove(e.root);
      this.entries.delete(key);
    }
    this.primed = true;
    this.particles.update(dt);
  }

  private create(item: number, tx: number, ty: number, time: number): Entry {
    const root = new THREE.Group();
    const body = itemBody(item);
    root.add(body, shellMesh(item));
    tileToWorld(tx, ty, 0, root.position);
    this.group.add(root);
    return { root, body, item, tx, ty, born: time };
  }

  private burstAt(e: Entry, count: number): void {
    this.particles.burst(e.root.position.x, FLOAT * ITEM_SCALE, e.root.position.z, ITEM_LOOK[e.item].color, count);
  }

  clear(): void {
    this.entries.clear();
    this.group.clear();
    this.group.add(this.particles.points);
    this.particles.clear();
    this.primed = false;
    this.lastTime = -1;
  }
}
