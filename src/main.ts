import * as THREE from 'three';
import { readLocalCommand } from './input/commands';
import { KeyboardSource } from './input/keyboard';
import { TouchSource } from './input/touch';
import { GRID_H, GRID_W, TICK_MS } from './sim/constants';
import { step } from './sim/sim';
import { gateOpen } from './sim/items';
import { createGame, type GameState, type SimEvent } from './sim/state';
import { BoardView } from './view/board_view';
import { CameraRig } from './view/camera_rig';
import { GateView, ItemsView, MartiansView } from './view/actors_view';
import { BeamsView, ChargesView, DebrisView } from './view/effects_view';
import { HeroView } from './view/hero_view';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- Rendering ---------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161d);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a2a1c, 1.4));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
sun.position.set(-5, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
scene.add(sun);

const rig = new CameraRig();
const board = new BoardView();
const hero = new HeroView();
const charges = new ChargesView();
const beams = new BeamsView(GRID_W * GRID_H);
const debris = new DebrisView();
const items = new ItemsView();
const gate = new GateView();
const martians = new MartiansView();
scene.add(board.group, hero.group, charges.group, beams.group, debris.group, items.group, gate.group, martians.group);

// --- Input -------------------------------------------------------------------
const keys = new KeyboardSource();
const touch = new TouchSource($('stick-zone'), $('stick-base'), $('stick-knob'), $('place-btn'));

// --- Game state --------------------------------------------------------------
let state: GameState;
let prev = { x: 0, y: 0 };
const prevMartians = new Map<number, { x: number; y: number }>();
/** Survival level: each one adds a Goopling (3 on level 1, up to 6). */
let level = 1;

function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
  // Math.random is fine HERE: it only picks the seed. Inside sim/ it is banned.
  state = createGame(seed, { martians: Math.min(2 + level, 6) });
  prev = { x: state.players[0].x, y: state.players[0].y };
  snapshotMartians();
  board.build(state);
  charges.clear();
  items.clear();
  martians.clear();
  hideBanner();
  updateHud();
}

function snapshotMartians() {
  prevMartians.clear();
  for (const m of state.martians) prevMartians.set(m.id, { x: m.x, y: m.y });
}

// --- Level banner ------------------------------------------------------------------
const banner = $('banner');
const bannerBtn = $<HTMLButtonElement>('banner-btn');
function showBanner(title: string, text: string, button: string) {
  $('banner-title').textContent = title;
  $('banner-text').textContent = text;
  bannerBtn.textContent = button;
  banner.hidden = false;
}
function hideBanner() {
  banner.hidden = true;
}
bannerBtn.addEventListener('click', () => {
  if (state.status === 'game_over') level = 1;
  else level++;
  newGame();
});

/** Turns sim events into effects. Sounds will hook in here too. */
function onEvent(e: SimEvent) {
  switch (e.type) {
    case 'rock_broken':
      board.breakRock(e.tx, e.ty);
      debris.burst(e.tx, e.ty, 0xd9773f);
      break;
    case 'charge_exploded':
      rig.shake();
      break;
    case 'player_died':
      debris.burst(e.tx, e.ty, 0x3a7bff, 14);
      break;
    case 'martian_killed':
      debris.burst(e.tx, e.ty, 0x6fd14f, 12);
      break;
    case 'item_destroyed':
      debris.burst(e.tx, e.ty, 0xffffff, 6);
      break;
    case 'level_clear':
      showBanner('Level clear!', `All Martians defeated on level ${level}.`, 'Next level');
      break;
    case 'game_over':
      showBanner('Game over', `The Martians got you on level ${level}.`, 'Try again');
      break;
    case 'player_respawned': {
      const p = state.players[e.id];
      prev = { x: p.x, y: p.y };
      break;
    }
  }
}

const hudInfo = $('hud-info');
let lastHud = '';
function updateHud() {
  const p = state.players[0];
  const left = state.martians.filter((m) => m.alive).length;
  const parts = [
    `Level ${level}`,
    `Lives ${p.lives}`,
    `Charges ${p.maxCharges}`,
    `Range ${p.range}`,
    p.boots > 0 ? `Boots ${p.boots}` : '',
    p.vest > 0 ? `Vest ${Math.ceil(p.vest / 60)}s` : '',
    state.freeze > 0 ? `Frozen ${Math.ceil(state.freeze / 60)}s` : '',
    left > 0 ? `Martians ${left}` : gateOpen(state) ? 'Gate open!' : 'Find the Warp Gate',
    p.alive ? '' : 'Knocked out!',
  ];
  const text = parts.filter(Boolean).join(' · ');
  if (text !== lastHud) hudInfo.textContent = lastHud = text;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') newGame();
  if ((e.code === 'Enter' || e.code === 'Space') && !banner.hidden) bannerBtn.click();
});
$('new-map').addEventListener('click', () => newGame());

// --- Layout --------------------------------------------------------------------
/** Gutter width for the touch controls: about 16% of the width, 110-170 px. */
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const gutter = Math.round(Math.min(170, Math.max(110, w * 0.16)));
  const hud = 44;
  document.documentElement.style.setProperty('--gutter', `${gutter}px`);
  document.documentElement.style.setProperty('--hud', `${hud}px`);
  renderer.setSize(w, h, false);
  rig.fit(w, h, gutter, gutter, hud + 2, 4);
}
window.addEventListener('resize', layout);
layout();

// --- Fixed-timestep loop -----------------------------------------------------------
newGame();
let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(now - last, 250);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= TICK_MS && steps < 5) {
    const p = state.players[0];
    prev = { x: p.x, y: p.y };
    snapshotMartians();
    step(state, [readLocalCommand(keys, touch)]);
    for (const e of state.events) onEvent(e);
    acc -= TICK_MS;
    steps++;
  }
  if (steps === 5) acc = 0; // too far behind (tab was hidden): drop the backlog
  const seconds = dt / 1000;
  hero.update(prev, state.players[0], acc / TICK_MS, seconds);
  const time = now / 1000;
  charges.sync(state);
  beams.sync(state);
  items.sync(state, time);
  gate.sync(state, time);
  martians.sync(state, prevMartians, acc / TICK_MS, time);
  debris.update(seconds);
  rig.update(seconds);
  updateHud();
  renderer.render(scene, rig.camera);
});

// Dev-only console hook for debugging: `spaceblast.state` in the browser
// console. Stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { spaceblast: { get state() { return state; } } });
