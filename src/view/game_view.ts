import * as THREE from 'three';
import { AdaptiveQuality } from './quality';
import { GRID_H, GRID_W, TILE } from '../sim/constants';
import type { GameState, SimEvent } from '../sim/state';
import type { Prediction } from '../net/predict';
import { GateView, MartiansView, PortalsView } from './actors_view';
import { ItemsView } from './items_view';
import { BoardView } from './board_view';
import { BossView, CrossPreviewView } from './boss_view';
import { CameraRig, blastShake } from './camera_rig';
import { toWorld } from './coords';
import { BeamsView, ChargesView, DebrisView } from './effects_view';
import { HeroView } from './hero_view';
import { TileHighlight } from './tile_highlight';
import { LightingView, ShiftPreviewView } from './level_view';

// The whole 3D scene: renderer, lights, camera and every view. It draws a
// GameState (interpolating between ticks) and turns sim events into effects.
// Reads the state only, never changes it.

/** A touch-first device (phone or tablet): drawn with lighter settings. */
const PHONE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly heroes = [0, 1, 2, 3].map(() => new HeroView());
  readonly debris = new DebrisView();
  private board = new BoardView();
  private charges = new ChargesView();
  private beams = new BeamsView(GRID_W * GRID_H);
  private items = new ItemsView();
  private gate = new GateView();
  private martians = new MartiansView();
  private portals = new PortalsView();
  private boss = new BossView();
  private crossPreview = new CrossPreviewView(GRID_W * GRID_H);
  private shiftPreview = new ShiftPreviewView(GRID_W * GRID_H);
  private lighting: LightingView;
  /** Positions before the last tick, so movement can be interpolated. */
  private prevPlayers: { x: number; y: number }[] = [];
  private prevMartians = new Map<number, { x: number; y: number }>();
  private colors: number[] = [];
  /** The player this screen belongs to: shakes are measured from them, and their tile is highlighted. */
  private you = 0;
  private highlight = new TileHighlight();

  /** Render resolution, lowered automatically on slow phones (phones start at 1.5x at most). */
  private quality = new AdaptiveQuality(PHONE ? Math.min(window.devicePixelRatio || 1, 1.5) : window.devicePixelRatio || 1);

  constructor(canvas: HTMLCanvasElement) {
    // Phones: a sharp screen needs no antialiasing, and plain shadows from a
    // smaller map look almost the same at phone size for much less GPU work.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !PHONE || (window.devicePixelRatio || 1) < 2 });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PHONE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

    const scene = this.scene;
    scene.background = new THREE.Color(0x14161d);
    const sky = new THREE.HemisphereLight(0xdfe8ff, 0x5a2a1c, 1.4);
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
    sun.position.set(-5, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(PHONE ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    scene.add(sky, sun);
    scene.add(this.board.group, this.charges.group, this.beams.group, this.debris.group, this.items.group, this.gate.group);
    scene.add(this.martians.group, this.portals.group, this.boss.group, this.crossPreview.group, this.shiftPreview.group);
    for (const h of this.heroes) scene.add(h.group);
    scene.add(this.highlight.mesh);
    this.lighting = new LightingView([sky, sun], scene, scene.background as THREE.Color);
  }

  /** Resets everything for a new map. `colors` per player; `local` gets the "you" arrow (-1 for none). */
  build(state: GameState, colors: number[], local: number): void {
    this.colors = colors;
    this.you = local >= 0 ? local : 0;
    this.highlight.setColor(colors[this.you] ?? 0xffffff);
    this.board.build(state);
    this.charges.clear();
    this.items.clear();
    this.martians.clear();
    this.heroes.forEach((h, i) => {
      h.group.visible = i < state.players.length;
      h.setColor(colors[i] ?? 0xffffff);
      h.setYou(i === local);
      h.celebrate(false);
      // Online (a local player is set): server frames arrive unevenly, so astronauts glide (view/smooth.ts).
      h.smooth = local >= 0;
      h.resetGlide();
    });
    this.snapshot(state);
  }

  /** Call before each step: remembers positions for interpolation. */
  snapshot(state: GameState): void {
    this.prevPlayers = state.players.map((p) => ({ x: p.x, y: p.y }));
    this.prevMartians.clear();
    for (const m of state.martians) this.prevMartians.set(m.id, { x: m.x, y: m.y });
  }

  /** Visual effects for one sim event. */
  effect(e: SimEvent, state: GameState): void {
    const { board, debris, rig } = this;
    switch (e.type) {
      case 'rock_broken':
        board.breakRock(e.tx, e.ty);
        debris.burst(e.tx, e.ty, 0xd9773f);
        break;
      case 'charge_exploded': {
        // Near blasts shake hard, ones across the arena barely or not at all.
        const me = state.players[this.you];
        if (me) rig.shake(blastShake(Math.abs(Math.round(me.x / TILE) - e.tx) + Math.abs(Math.round(me.y / TILE) - e.ty)));
        break;
      }
      case 'player_died':
        debris.burst(e.tx, e.ty, this.colors[e.id] ?? 0xffffff, 14);
        break;
      case 'martian_killed':
        debris.burst(e.tx, e.ty, 0x6fd14f, 12);
        break;
      case 'item_destroyed':
        debris.burst(e.tx, e.ty, 0xffffff, 6);
        break;
      case 'rock_built':
        board.addRock(e.tx, e.ty);
        debris.burst(e.tx, e.ty, 0xc6e33a, 5);
        break;
      case 'maze_shift':
        for (const i of e.removed) board.breakRock(i % GRID_W, Math.floor(i / GRID_W));
        for (const i of e.added) {
          board.addRock(i % GRID_W, Math.floor(i / GRID_W));
          debris.burst(i % GRID_W, Math.floor(i / GRID_W), 0xd9773f, 4);
        }
        rig.shake(0.5);
        break;
      case 'boss_cross':
        rig.shake(0.8);
        break;
      case 'boss_defeated':
        if (state.boss) debris.burst(state.boss.tile % GRID_W, Math.floor(state.boss.tile / GRID_W), 0xffe9a8, 30);
        break;
      case 'tile_collapsed':
        board.dropBlock(e.tx, e.ty);
        break;
      case 'player_respawned': {
        const p = state.players[e.id];
        this.prevPlayers[e.id] = { x: p.x, y: p.y };
        break;
      }
    }
  }

  /**
   * Draws `state`; alpha in [0, 1] is how far we are towards the next tick.
   * `predicted` (online): your astronaut and fresh charges from net/predict.ts.
   */
  render(state: GameState, alpha: number, dt: number, time: number, predicted: { id: number; p: Prediction } | null = null): void {
    state.players.forEach((p, i) => {
      if (predicted?.id === i) this.heroes[i].update(predicted.p.prev, predicted.p.cur, alpha, dt);
      else this.heroes[i].update(this.prevPlayers[i] ?? p, p, alpha, dt);
    });
    this.charges.sync(state, predicted?.p.charges);
    this.beams.sync(state);
    this.items.reduced = this.quality.reduced;
    for (const h of this.heroes) h.reduced = this.quality.reduced;
    this.items.sync(state, time);
    this.gate.sync(state, time);
    this.martians.sync(state, this.prevMartians, alpha, time);
    this.portals.sync(state, time);
    this.boss.sync(state, time);
    this.crossPreview.sync(state, time);
    this.shiftPreview.sync(state, time);
    this.lighting.sync(state, state.players.map((_, i) => this.heroes[i].group), dt);
    // Online the local astronaut is drawn from the prediction: mark the tile it is drawn on.
    this.highlight.update(predicted?.id === this.you ? predicted.p.cur : state.players[this.you] ?? null, dt);
    this.board.update(dt);
    this.debris.update(dt);
    this.rig.update(dt);
    this.renderer.render(this.scene, this.rig.camera);
  }

  /** Fits the camera between the touch gutters and below the HUD. */
  /** Call once per rendered frame: a slow phone gets a lower pixel ratio. */
  frameTime(ms: number): void {
    const ratio = this.quality.frame(ms);
    if (ratio === null) return;
    this.renderer.setPixelRatio(ratio);
    const c = this.renderer.domElement;
    this.renderer.setSize(c.clientWidth, c.clientHeight, false);
  }

  /** The canvas size in CSS px, and the space the arena must keep clear on each side. */
  layout(w: number, h: number, left: number, right: number, top: number): void {
    this.renderer.setSize(w, h, false);
    this.rig.fit(w, h, left, right, top + 2, 4);
  }

  /** World position of a sim position (for camera moves). */
  worldOf(x: number, y: number): THREE.Vector3 {
    return toWorld(x, y, 0.4);
  }
}
