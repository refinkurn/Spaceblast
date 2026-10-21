import * as THREE from 'three';
import { Cell, Item } from '../sim/constants';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';
import { auraMesh, ITEM_LOOK, itemBody, shellMesh } from './item_look';
import { ParticlePool } from './particles';

// Power-ups on the grid: a low-poly item floating in a glass shell, a pulsing
// floor aura, idle sparkles from one shared particle pool, and bursts when an
// item appears or is picked up. View only; reads the state, never writes it.

const FLOAT = 0.3;
const SPIN = (30 * Math.PI) / 180; // rad/s
const POP_SECONDS = 0.2;
/** Idle dots per second per item. */
const IDLE_RATE = 2;

interface Entry {
  root: THREE.Group;
  body: THREE.Group;
  aura: THREE.Mesh;
  item: number;
  tx: number;
  ty: number;
  born: number;
}

export class ItemsView {
  readonly group = new THREE.Group();
  readonly particles = new ParticlePool();
  /** Set by the game view when AdaptiveQuality has stepped down: no aura, no idle dots. */
  reduced = false;
  private entries = new Map<number, Entry>();
  private lastTime = -1;
  private idleCarry = 0;
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
      e.root.scale.setScalar(Math.max(pop, 0.001));
      e.aura.visible = !this.reduced;
      (e.aura.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(time * 2.2 + phase);
      if (!this.reduced) e.aura.scale.setScalar(1 + 0.08 * Math.sin(time * 2.2 + phase));
    }
    // Gone from the grid (picked up): a burst in its colour.
    for (const [key, e] of this.entries) {
      if (seen.has(key)) continue;
      this.burstAt(e, 10);
      this.group.remove(e.root);
      this.entries.delete(key);
    }
    this.primed = true;

    // Idle sparkles rising from each aura.
    if (!this.reduced && dt > 0) {
      this.idleCarry += dt * IDLE_RATE * this.entries.size;
      while (this.idleCarry >= 1) {
        this.idleCarry -= 1;
        const list = [...this.entries.values()];
        const e = list[Math.floor(Math.random() * list.length)];
        const p = e.root.position;
        this.particles.emit(
          p.x + (Math.random() - 0.5) * 0.4, 0.05, p.z + (Math.random() - 0.5) * 0.4,
          0, 0.45 + Math.random() * 0.3, 0, ITEM_LOOK[e.item].color, 0.9,
        );
      }
    } else if (this.reduced) {
      this.idleCarry = 0;
    }
    this.particles.update(dt);
  }

  private create(item: number, tx: number, ty: number, time: number): Entry {
    const root = new THREE.Group();
    const body = itemBody(item);
    root.add(body, shellMesh(item));
    const aura = auraMesh(item);
    root.add(aura);
    tileToWorld(tx, ty, 0, root.position);
    aura.position.y = 0.03;
    this.group.add(root);
    return { root, body, aura, item, tx, ty, born: time };
  }

  private burstAt(e: Entry, count: number): void {
    this.particles.burst(e.root.position.x, FLOAT, e.root.position.z, ITEM_LOOK[e.item].color, count);
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
