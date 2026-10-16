import * as THREE from 'three';
import { Screens, type MenuChoice } from './flow/screens';
import { Bot } from './input/bot';
import { readLocalCommand } from './input/commands';
import { KeyboardSource } from './input/keyboard';
import { TouchSource } from './input/touch';
import { GATE_WAIT_TICKS, GRID_H, GRID_W, LevelEvent, TICK_MS } from './sim/constants';
import type { PlayerCommand } from './sim/command';
import { gateOpen } from './sim/items';
import { LEVEL_COUNT, levelRoster, levelRules, sectorOf } from './sim/levels';
import { step } from './sim/sim';
import { createGame, type GameState, type SimEvent } from './sim/state';
import { GateView, ItemsView, MartiansView, PortalsView } from './view/actors_view';
import { BoardView } from './view/board_view';
import { CameraRig } from './view/camera_rig';
import { BeamsView, ChargesView, DebrisView } from './view/effects_view';
import { HeroView } from './view/hero_view';
import { LightingView, ShiftPreviewView } from './view/level_view';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Battle: first to this many round wins takes the match. */
const ROUNDS_TO_WIN = 3;
const HERO_COLORS = [0x3a7bff, 0xff6a3d];

// --- Rendering ---------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161d);
const sky = new THREE.HemisphereLight(0xdfe8ff, 0x5a2a1c, 1.4);
scene.add(sky);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
sun.position.set(-5, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
scene.add(sun);

const rig = new CameraRig();
const board = new BoardView();
const heroes = HERO_COLORS.map((c) => new HeroView(c));
const charges = new ChargesView();
const beams = new BeamsView(GRID_W * GRID_H);
const debris = new DebrisView();
const items = new ItemsView();
const gate = new GateView();
const martians = new MartiansView();
const portals = new PortalsView();
scene.add(board.group, charges.group, beams.group, debris.group, items.group, gate.group, martians.group, portals.group);
for (const h of heroes) scene.add(h.group);
const shiftPreview = new ShiftPreviewView(GRID_W * GRID_H);
scene.add(shiftPreview.group);
const lighting = new LightingView([sky, sun], scene, scene.background as THREE.Color);

// --- Input -------------------------------------------------------------------
const keys = new KeyboardSource();
const touch = new TouchSource($('stick-zone'), $('stick-base'), $('stick-knob'), $('place-btn'));

// --- Session: mode, survival level, battle score ---------------------------------
let mode: MenuChoice = 'survival';
let state: GameState;
let bot: Bot | null = null;
/** Survival level, 1..20; each sector of 5 adds a new Martian kind. */
let level = 1;
/** Shown before the level where each event first appears. */
const EVENT_INTRO: Record<number, string> = {
  5: 'New: Maze Shift. The Martians move rocks around. Flashing tiles show where, 3 s ahead.',
  8: 'New: the Warp Gate wanders. Leave it waiting 10 s and it moves somewhere else.',
  10: 'New: Blackouts. The lights go out for a while; watch for the warning.',
};
/** What each sector's new Martian does, shown when it first appears. */
const SECTOR_INTRO = [
  'Gooplings wander the maze. Find the Warp Gate under a rock and step on it.',
  'New: Sniffers. Faster, and they dodge your charges once they spot them.',
  'New: Phasers. They hide in burrows (can\'t be hit) and jump through portals.',
  'New: Builders. Toxic to touch, and they wall you in with new rocks.',
];
let round = 1;
let score = [0, 0];
let prevPlayers: { x: number; y: number }[] = [];
const prevMartians = new Map<number, { x: number; y: number }>();

const screens = new Screens(startMode, openMenu);

function startMode(m: MenuChoice) {
  mode = m;
  level = 1;
  round = 1;
  score = [0, 0];
  screens.hideMenu();
  newGame();
}

function openMenu() {
  screens.showMenu();
}

function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
  // Math.random is fine HERE: it only picks the seed. Inside sim/ it is banned.
  state = mode === 'battle'
    ? createGame(seed, { mode: 'battle' })
    : createGame(seed, { roster: levelRoster(level), rules: levelRules(level) });
  bot = mode === 'battle' ? new Bot(1, seed) : null;
  snapshot();
  board.build(state);
  charges.clear();
  items.clear();
  martians.clear();
  screens.hideBanner();
  heroes.forEach((h, i) => (h.group.visible = i < state.players.length));
  updateHud();
}

/** Positions before a tick, so the view can interpolate between ticks. */
function snapshot() {
  prevPlayers = state.players.map((p) => ({ x: p.x, y: p.y }));
  prevMartians.clear();
  for (const m of state.martians) prevMartians.set(m.id, { x: m.x, y: m.y });
}

function commands(): PlayerCommand[] {
  const local = readLocalCommand(keys, touch);
  return bot ? [local, bot.think(state)] : [local];
}

// --- Events -> effects and results ---------------------------------------------------
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
      debris.burst(e.tx, e.ty, HERO_COLORS[e.id] ?? 0xffffff, 14);
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
      rig.shake(0.3);
      break;
    case 'gate_moved':
      flash(e.hidden ? 'The Warp Gate moved under a rock!' : 'The Warp Gate moved!');
      break;
    case 'player_respawned': {
      const p = state.players[e.id];
      prevPlayers[e.id] = { x: p.x, y: p.y };
      break;
    }
    case 'level_clear':
      levelClear();
      break;
    case 'game_over':
      screens.showBanner('Game over', `The Martians got you on level ${level}.`, 'Try again', () => { level = 1; newGame(); });
      break;
    case 'round_over':
      roundOver(e.winner);
      break;
  }
}

function levelClear() {
  if (level >= LEVEL_COUNT) {
    screens.showBanner('All 20 levels cleared!', 'The Hive is beaten. The Blaster boss and Endless Survival are coming next.', 'Play again', () => { level = 1; newGame(); });
    return;
  }
  const next = level + 1;
  const newSector = sectorOf(next) !== sectorOf(level);
  const text = EVENT_INTRO[next] ?? (newSector ? SECTOR_INTRO[sectorOf(next) - 1] : `Level ${next} has ${levelRoster(next).length} Martians.`);
  screens.showBanner(`Level ${level} clear!`, text, 'Next level', () => { level = next; newGame(); });
}

function roundOver(winner: number) {
  if (winner >= 0) score[winner]++;
  const title = winner === 0 ? 'You win the round!' : winner === 1 ? 'The bot wins the round' : 'Draw';
  const tally = `You ${score[0]} – ${score[1]} Bot`;
  if (Math.max(...score) >= ROUNDS_TO_WIN) {
    const won = score[0] > score[1];
    screens.showBanner(won ? 'You win the match!' : 'The bot wins the match', tally, 'Play again', () => startMode('battle'));
  } else {
    screens.showBanner(title, tally, 'Next round', () => { round++; newGame(); });
  }
}

// --- Event warnings ------------------------------------------------------------------
const alertEl = $('alert');
let flashUntil = 0;
let flashText = '';
/** Shows a short message in the warning pill for 2 s. */
function flash(text: string) {
  flashText = text;
  flashUntil = performance.now() + 2000;
}
function updateAlert(now: number) {
  let text = '';
  const secs = (ticks: number) => Math.ceil(ticks / 60);
  if (state.event !== LevelEvent.None && state.eventWarning > 0) {
    text = `${state.event === LevelEvent.MazeShift ? 'Maze Shift' : 'Blackout'} in ${secs(state.eventWarning)}`;
  } else if (state.event === LevelEvent.Blackout && state.eventActive > 0) {
    text = `Blackout · ${secs(state.eventActive)}s`;
  } else if (now < flashUntil) {
    text = flashText;
  }
  alertEl.hidden = text === '' || state.status !== 'playing' || screens.menuOpen;
  if (alertEl.textContent !== text) alertEl.textContent = text;
}

// --- HUD ---------------------------------------------------------------------------
const hudInfo = $('hud-info');
let lastHud = '';
function updateHud() {
  const p = state.players[0];
  const powers = [
    `Charges ${p.maxCharges}`,
    `Range ${p.range}`,
    p.boots > 0 ? `Boots ${p.boots}` : '',
    p.vest > 0 ? `Vest ${Math.ceil(p.vest / 60)}s` : '',
  ];
  let parts: string[];
  if (mode === 'battle') {
    const secs = Math.ceil(state.timeLeft / 60);
    parts = [`Round ${round}`, `You ${score[0]} – ${score[1]} Bot`, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, ...powers];
  } else {
    const left = state.martians.filter((m) => m.alive).length;
    parts = [
      `Sector ${sectorOf(level)} · Level ${level}`,
      `Lives ${p.lives}`,
      ...powers,
      state.freeze > 0 ? `Frozen ${Math.ceil(state.freeze / 60)}s` : '',
      `Martians ${left}`,
      gateOpen(state)
        ? state.rules.gateWander ? `Gate open · moves in ${Math.ceil((GATE_WAIT_TICKS - state.gateWait) / 60)}s` : 'Gate open!'
        : 'Find the Warp Gate',
    ];
  }
  if (!p.alive && state.status === 'playing') parts.push('Knocked out!');
  const text = parts.filter(Boolean).join(' · ');
  if (text !== lastHud) hudInfo.textContent = lastHud = text;
}

window.addEventListener('keydown', (e) => {
  if (screens.menuOpen) return;
  if (e.code === 'Escape') openMenu();
  else if ((e.code === 'Enter' || e.code === 'Space') && screens.bannerOpen) screens.pressPrimary();
  else if (e.code === 'KeyR' && mode === 'survival') newGame();
});

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
// A survival map plays behind the start screen; the sim waits while the menu is open.
newGame();
openMenu();
let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(now - last, 250);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= TICK_MS && steps < 5) {
    if (!screens.menuOpen) {
      snapshot();
      step(state, commands());
      for (const e of state.events) onEvent(e);
    }
    acc -= TICK_MS;
    steps++;
  }
  if (steps === 5) acc = 0; // too far behind (tab was hidden): drop the backlog
  const seconds = dt / 1000;
  const time = now / 1000;
  const alpha = acc / TICK_MS;
  state.players.forEach((p, i) => heroes[i].update(prevPlayers[i] ?? p, p, alpha, seconds));
  charges.sync(state);
  beams.sync(state);
  items.sync(state, time);
  gate.sync(state, time);
  martians.sync(state, prevMartians, alpha, time);
  portals.sync(state, time);
  shiftPreview.sync(state, time);
  lighting.sync(state, heroes.map((h) => h.group), seconds);
  updateAlert(now);
  debris.update(seconds);
  rig.update(seconds);
  updateHud();
  renderer.render(scene, rig.camera);
});

// Dev-only console hooks for debugging (`spaceblast.state`, `spaceblast.startLevel(n)`)
// in the browser console. Stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(window, {
    spaceblast: {
      get state() { return state; },
      /** Jump straight to a survival level, e.g. spaceblast.startLevel(16). */
      startLevel(n: number) { mode = 'survival'; level = n; screens.hideMenu(); newGame(); },
    },
  });
}
