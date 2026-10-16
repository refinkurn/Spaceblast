import * as THREE from 'three';
import { GATE_FLICKER_TICKS, GATE_WAIT_TICKS, LevelEvent } from '../sim/constants';
import type { GameState } from '../sim/state';
import { tileToWorld } from './coords';

// Visuals for level events: the Maze Shift preview, Blackout lighting and the
// gate flicker. Reads sim state each frame; never writes it.

/** During a Maze Shift warning, rocks about to vanish pulse red and new spots pulse yellow. */
export class ShiftPreviewView {
  readonly group = new THREE.Group();
  private remove: THREE.InstancedMesh;
  private add: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private pos = new THREE.Vector3();

  constructor(maxTiles: number) {
    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    this.remove = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.4, depthWrite: false }), maxTiles);
    this.add = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe25a, transparent: true, opacity: 0.3, depthWrite: false }), maxTiles);
    this.group.add(this.remove, this.add);
  }

  sync(state: GameState, time: number): void {
    const warning = state.event === LevelEvent.MazeShift && state.eventWarning > 0;
    const pulse = 0.25 + 0.25 * Math.abs(Math.sin(time * 8));
    const place = (mesh: THREE.InstancedMesh, tiles: number[]) => {
      mesh.count = warning ? tiles.length : 0;
      tiles.forEach((i, n) => {
        tileToWorld(i % state.grid.w, Math.floor(i / state.grid.w), 0.48, this.pos);
        mesh.setMatrixAt(n, this.m.makeTranslation(this.pos));
      });
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.material as THREE.MeshBasicMaterial).opacity = pulse + 0.1;
    };
    place(this.remove, state.shiftRemove);
    place(this.add, state.shiftAdd);
  }
}

/**
 * Blackout: the scene lights fade almost to nothing while a glow follows each
 * astronaut. Unlit things (charges, beams, Martian eyes) stay visible.
 */
export class LightingView {
  private glows: THREE.PointLight[] = [];
  private dark = 0;
  private normal: number[];

  constructor(private lights: THREE.Light[], scene: THREE.Scene, private background: THREE.Color) {
    this.normal = lights.map((l) => l.intensity);
    for (let i = 0; i < 4; i++) {
      const glow = new THREE.PointLight(0xbfe4ff, 0, 3.2, 1.6);
      this.glows.push(glow);
      scene.add(glow);
    }
  }

  sync(state: GameState, heroes: THREE.Object3D[], dt: number): void {
    const target = state.event === LevelEvent.Blackout && state.eventActive > 0 ? 1 : 0;
    this.dark += (target - this.dark) * (1 - Math.exp(-4 * dt));
    this.lights.forEach((l, i) => (l.intensity = this.normal[i] * (1 - 0.985 * this.dark)));
    const k = 1 - 0.8 * this.dark;
    this.background.setRGB(0.078 * k, 0.086 * k, 0.114 * k);
    this.glows.forEach((g, i) => {
      const hero = heroes[i];
      const on = hero !== undefined && hero.visible && i < state.players.length;
      g.intensity = on ? 10 * this.dark : 0;
      if (on) g.position.set(hero.position.x, 1.2, hero.position.z);
    });
  }
}

/** 0..1: how strongly the gate should flicker before it moves (0 = steady). */
export function gateFlicker(state: GameState): number {
  if (!state.rules.gateWander || state.gateWait < GATE_WAIT_TICKS - GATE_FLICKER_TICKS) return 0;
  return (state.gateWait - (GATE_WAIT_TICKS - GATE_FLICKER_TICKS)) / GATE_FLICKER_TICKS;
}
