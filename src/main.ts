import * as THREE from 'three';
import { DevPanel, GOD_SHIELD } from './flow/dev';
import { Hud } from './flow/hud';
import { OnlineRoom, type RoundStart } from './flow/online';
import { Screens, type MenuChoice } from './flow/screens';
import { BOSS_NAMES, ENDING, SECTORS, briefing } from './flow/story';
import { Bot } from './input/bot';
import { readLocalCommand } from './input/commands';
import { KeyboardSource } from './input/keyboard';
import { TouchSource } from './input/touch';
import { Lockstep } from './net/lockstep';
import { bossWarning } from './sim/boss';
import { GRID_H, GRID_W, Kind, MAX_BOOTS, MAX_CHARGES, MAX_RANGE, LevelEvent, TICK_MS } from './sim/constants';
import type { PlayerCommand } from './sim/command';
import { LEVEL_COUNT, isSectorStart, levelRoster, levelSpec } from './sim/levels';
import { hashState, step } from './sim/sim';
import { createGame, type GameState, type SimEvent } from './sim/state';
import { GateView, ItemsView, MartiansView, PortalsView } from './view/actors_view';
import { BoardView } from './view/board_view';
import { BossView, CrossPreviewView } from './view/boss_view';
import { CameraRig } from './view/camera_rig';
import { BeamsView, ChargesView, DebrisView } from './view/effects_view';
import { HeroView } from './view/hero_view';
import { LightingView, ShiftPreviewView } from './view/level_view';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Battle: first to this many round wins takes the match. */
const ROUNDS_TO_WIN = 3;
/** You (blue), the rival (orange: battle bot or the Renegade Pilot), then online players 3 and 4. */
const HERO_COLORS = [0x3a7bff, 0xff6a3d, 0x4fd17a, 0xc77dff];
/** How long the level briefing stays up (the game waits meanwhile). */
const CARD_MS = 3000;

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
const boss = new BossView();
const crossPreview = new CrossPreviewView(GRID_W * GRID_H);
const shiftPreview = new ShiftPreviewView(GRID_W * GRID_H);
scene.add(board.group, charges.group, beams.group, debris.group, items.group, gate.group, martians.group, portals.group);
scene.add(boss.group, crossPreview.group, shiftPreview.group);
for (const h of heroes) scene.add(h.group);
const lighting = new LightingView([sky, sun], scene, scene.background as THREE.Color);

// --- Input -------------------------------------------------------------------
const keys = new KeyboardSource();
const touch = new TouchSource($('stick-zone'), $('stick-base'), $('stick-knob'), $('place-btn'));

// --- Session: mode, story level, battle score ------------------------------------
let mode: MenuChoice = 'survival';
let state: GameState;
let bot: Bot | null = null;
let level = 1;
let round = 1;
let score = [0, 0];
/** Martian kinds the player has already met this run (for "New:" on the briefing). */
const seenKinds = new Set<Kind>();
/** The game waits while the briefing card is up. */
let cardUntil = 0;
let prevPlayers: { x: number; y: number }[] = [];
const prevMartians = new Map<number, { x: number; y: number }>();

const screens = new Screens(startMode, openMenu);
const hud = new Hud();
const online = new OnlineRoom();
/** Online round state; null outside an online round. */
let lockstep: Lockstep | null = null;
let netRound = 0;
/** Room slot of each sim player this round. */
let netSlots: number[] = [];
let matchOver = false;
/** Sim player id of this browser's astronaut (always 0 offline). */
let localId = 0;
/** Hero model (and colour) for each sim player; online it follows the room slot. */
let heroOf = [0, 1, 2, 3];
/** Desync check: this browser's state hashes by tick, and hashes from the others not yet compared. */
const myHashes = new Map<number, number>();
const pendingHashes = new Map<number, number[]>();
let lastWinner = -1;
/** Set when a run was started from the developer level select; enables its cheats. */
let devRun = false;
const dev = new DevPanel(startAtLevel);

/** Developer level select: jump straight to a Story level. */
function startAtLevel(n: number) {
  mode = 'survival';
  level = n;
  devRun = true;
  dev.hide();
  screens.hideMenu();
  beginLevel(dev.opts.story);
}

function startMode(m: MenuChoice) {
  if (m === 'online') {
    screens.hideMenu();
    online.open();
    return;
  }
  mode = m;
  localId = 0;
  heroOf = [0, 1, 2, 3];
  level = 1;
  devRun = false;
  round = 1;
  score = [0, 0];
  seenKinds.clear();
  screens.hideMenu();
  if (mode === 'battle') newGame();
  else beginLevel(true);
}

function openMenu() {
  if (online.connected) online.exit(''); // leaving the room; onExit comes back here
  else screens.showMenu();
}

/** Story Mode: sector story card (levels 1, 6, 11, 16), then the level with its briefing. */
function beginLevel(withStory: boolean) {
  const spec = levelSpec(level);
  if (withStory && isSectorStart(level)) {
    const sector = SECTORS[spec.sector - 1];
    newGame(); // the new map shows dimly behind the card
    screens.showStory(`Sector ${spec.sector} of 4`, sector.name, sector.story, 'Begin', () => briefLevel());
    return;
  }
  newGame();
  briefLevel();
}

function briefLevel() {
  const spec = levelSpec(level);
  const b = briefing(spec, (k) => !seenKinds.has(k));
  for (const k of spec.roster) seenKinds.add(k);
  screens.showLevelCard(b.title, b.context, b.goal, b.hazards);
  cardUntil = performance.now() + CARD_MS;
}

function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
  // Math.random is fine HERE: it only picks the seed. Inside sim/ it is banned.
  const spec = levelSpec(level);
  state = mode === 'online'
    ? createGame(seed, { mode: 'battle', players: netSlots.length })
    : mode === 'battle'
    ? createGame(seed, { mode: 'battle' })
    : createGame(seed, { roster: spec.roster, rules: spec.rules, boss: spec.boss, rival: spec.rival });
  if (devRun && mode === 'survival') applyCheats();
  bot = mode === 'battle' ? new Bot(1, seed) : spec.rival ? new Bot(1, seed, 'hard') : null;
  snapshot();
  board.build(state);
  charges.clear();
  items.clear();
  martians.clear();
  screens.hideBanner();
  screens.hideLevelCard();
  cardUntil = 0;
  heroes.forEach((h, i) => (h.group.visible = heroOf.slice(0, state.players.length).includes(i)));
}

function applyCheats() {
  const hero = state.players[0];
  if (dev.opts.god) hero.shield = GOD_SHIELD;
  if (dev.opts.maxPower) {
    hero.range = MAX_RANGE;
    hero.maxCharges = MAX_CHARGES;
    hero.boots = MAX_BOOTS;
  }
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
      debris.burst(e.tx, e.ty, HERO_COLORS[heroOf[e.id]] ?? 0xffffff, 14);
      break;
    case 'armor_hit':
      flash('Oxygen Vest absorbed the hit!');
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
    case 'boss_cross':
      rig.shake(0.5);
      break;
    case 'boss_defeated':
      if (state.boss) debris.burst(state.boss.tile % GRID_W, Math.floor(state.boss.tile / GRID_W), 0xffe9a8, 30);
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
      screens.showBanner('Game over', `The Martians got you on level ${level}.`, 'Try again', () => { level = 1; beginLevel(false); });
      break;
    case 'round_over':
      if (mode === 'online') onlineRoundOver(e.winner);
      else roundOver(e.winner);
      break;
  }
}

function levelClear() {
  const spec = levelSpec(level);
  if (level >= LEVEL_COUNT) {
    screens.showStory('Story Mode complete', 'Mission accomplished', ENDING, 'Back to menu', openMenu);
    return;
  }
  const title = spec.boss ? `${BOSS_NAMES[spec.boss]} destroyed!` : `Level ${level} clear!`;
  const next = level + 1;
  const text = isSectorStart(next) ? `Sector ${spec.sector} complete. Next: ${SECTORS[spec.sector].name}.` : `Next: level ${next}, ${levelRoster(next).length} Martians.`;
  screens.showBanner(title, text, 'Next level', () => { level = next; beginLevel(true); });
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

// --- Online rooms --------------------------------------------------------------------
online.onRoundStart = (s: RoundStart) => {
  // A browser a few ticks behind finishes the old round first, so every score agrees.
  while (mode === 'online' && lockstep && state.status === 'playing' && lockstep.ready()) onlineStep();
  if (mode !== 'online' || matchOver) {
    score = [0, 0, 0, 0];
    round = 1;
    matchOver = false;
  } else {
    round++;
  }
  mode = 'online';
  netRound = s.r;
  netSlots = s.slots;
  localId = s.local;
  heroOf = s.slots;
  lockstep = new Lockstep(s.slots.length, s.local);
  myHashes.clear();
  pendingHashes.clear();
  screens.hideMenu();
  newGame(s.seed);
};
online.onInput = (slot, r, tick, c) => {
  if (lockstep && r === netRound) lockstep.receive(netSlots.indexOf(slot), tick, c);
};
online.onLeft = (slot, lastTick) => {
  if (lockstep && netSlots.includes(slot)) lockstep.playerLeft(netSlots.indexOf(slot), lastTick);
  if (mode === 'online' && screens.bannerOpen) onlineBanner(); // the host may have changed
};
online.onHash = (r, tick, h) => {
  if (r !== netRound) return;
  const mine = myHashes.get(tick);
  if (mine === undefined) pendingHashes.set(tick, [...(pendingHashes.get(tick) ?? []), h]);
  else if (mine !== h) desync(tick);
};
online.onExit = (reason) => {
  lockstep = null;
  if (mode === 'online') mode = 'battle';
  localId = 0;
  heroOf = [0, 1, 2, 3];
  if (!reason) {
    newGame();
    screens.showMenu();
  }
};

/** Runs one online tick if everyone's input is in. Returns false while waiting. */
function onlineStep(): boolean {
  if (!lockstep || state.status !== 'playing') return true;
  if (!lockstep.ready()) return false;
  snapshot();
  step(state, lockstep.advance(readLocalCommand(keys, touch)));
  for (const e of state.events) onEvent(e);
  if (state.tick % 60 === 0) {
    const h = hashState(state);
    myHashes.set(state.tick, h);
    online.sendHash(netRound, state.tick, h);
    if (pendingHashes.get(state.tick)?.some((x) => x !== h)) desync(state.tick);
    pendingHashes.delete(state.tick);
  }
  return true;
}

function sendInputs() {
  if (!lockstep) return;
  // Waiting on others (or the round is over): send what we have right away.
  const out = lockstep.takeOutgoing(state.status !== 'playing' || !lockstep.ready());
  if (out) online.sendInput(netRound, out.tick, out.c);
}

function desync(tick: number) {
  console.error(`Online desync at tick ${tick}`);
  flash('Out of sync with the other players!');
}

function onlineRoundOver(winner: number) {
  if (winner >= 0) score[netSlots[winner]]++;
  lastWinner = winner;
  matchOver = Math.max(...score) >= ROUNDS_TO_WIN;
  onlineBanner();
}

function onlineBanner() {
  const name = (id: number) => (id === localId ? 'You' : `Player ${netSlots[id] + 1}`);
  const unit = matchOver ? 'match' : 'round';
  const title = lastWinner < 0 ? 'Draw' : lastWinner === localId ? `You win the ${unit}!` : `${name(lastWinner)} wins the ${unit}`;
  const tally = netSlots.map((slot, id) => `${name(id)} ${score[slot]}`).join(' · ');
  if (online.slots.length < 2) {
    screens.showBanner(title, `${tally} · Everyone else left.`, 'Back to lobby', () => { screens.hideBanner(); online.showLobby(); });
  } else if (online.isHost) {
    screens.showBanner(title, tally, matchOver ? 'Play again' : 'Next round', () => online.startRound());
  } else {
    screens.showBanner(title, tally, 'Waiting for host…', () => {});
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
  const secs = (ticks: number) => Math.ceil(ticks / 60);
  const parts: string[] = [];
  if (state.boss && bossWarning(state)) parts.push(`Boss wave ${state.boss.wave + 1} in ${secs(state.boss.timer)}`);
  if (state.event !== LevelEvent.None && state.eventWarning > 0) {
    if (!state.boss) parts.push(`${state.event === LevelEvent.MazeShift ? 'Maze Shift' : 'Blackout'} in ${secs(state.eventWarning)}`);
  } else if (state.event === LevelEvent.Blackout && state.eventActive > 0) {
    parts.push(`Blackout · ${secs(state.eventActive)}s`);
  }
  if (parts.length === 0 && now < flashUntil) parts.push(flashText);
  const text = parts.join(' · ');
  alertEl.hidden = text === '' || state.status !== 'playing' || screens.menuOpen || screens.storyOpen;
  if (alertEl.textContent !== text) alertEl.textContent = text;
}

window.addEventListener('keydown', (e) => {
  if (screens.menuOpen || online.screenOpen) return;
  if (e.code === 'Escape') openMenu();
  else if ((e.code === 'Enter' || e.code === 'Space') && screens.storyOpen) screens.pressStory();
  else if ((e.code === 'Enter' || e.code === 'Space') && screens.bannerOpen) screens.pressPrimary();
  else if ((e.code === 'Enter' || e.code === 'Space') && cardUntil > 0) skipCard();
});
$('level-card').addEventListener('click', skipCard);

/** Tap or Enter dismisses the briefing early. */
function skipCard() {
  cardUntil = 0;
  screens.hideLevelCard();
}

// --- Layout --------------------------------------------------------------------
/** Gutter width for the touch controls: about 16% of the width, 110-170 px. */
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const gutter = Math.round(Math.min(170, Math.max(110, w * 0.16)));
  const hudHeight = 44;
  document.documentElement.style.setProperty('--gutter', `${gutter}px`);
  document.documentElement.style.setProperty('--hud', `${hudHeight}px`);
  renderer.setSize(w, h, false);
  rig.fit(w, h, gutter, gutter, hudHeight + 2, 4);
}
window.addEventListener('resize', layout);
layout();

// --- Fixed-timestep loop -----------------------------------------------------------
// A map plays behind the start screen; the sim waits while any card or the menu is open.
newGame();
openMenu();
let acc = 0;
let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(now - last, 250);
  last = now;
  acc += dt;
  if (cardUntil > 0 && now >= cardUntil) skipCard();
  const paused = screens.menuOpen || screens.storyOpen || cardUntil > 0 || online.screenOpen || (mode === 'online' && !lockstep);
  let steps = 0;
  while (acc >= TICK_MS && steps < 5) {
    if (!paused && mode === 'online') {
      if (!onlineStep()) {
        acc = Math.min(acc, TICK_MS); // waiting for another player's input
        break;
      }
    } else if (!paused) {
      snapshot();
      step(state, commands());
      for (const e of state.events) onEvent(e);
    }
    acc -= TICK_MS;
    steps++;
  }
  if (steps === 5 && mode !== 'online') acc = 0; // too far behind (tab was hidden): drop the backlog
  sendInputs();
  const seconds = dt / 1000;
  const time = now / 1000;
  const alpha = paused ? 1 : acc / TICK_MS;
  state.players.forEach((p, i) => heroes[heroOf[i]].update(prevPlayers[i] ?? p, p, alpha, seconds));
  charges.sync(state);
  beams.sync(state);
  items.sync(state, time);
  gate.sync(state, time);
  martians.sync(state, prevMartians, alpha, time);
  portals.sync(state, time);
  boss.sync(state, time);
  crossPreview.sync(state, time);
  shiftPreview.sync(state, time);
  lighting.sync(state, state.players.map((_, i) => heroes[heroOf[i]].group), seconds);
  updateAlert(now);
  debris.update(seconds);
  rig.update(seconds);
  const mine = mode === 'online' ? score[netSlots[localId]] ?? 0 : 0;
  const best = mode === 'online' ? Math.max(0, ...netSlots.filter((_, i) => i !== localId).map((s) => score[s])) : 0;
  hud.update(state, { mode, level, sector: levelSpec(level).sector, round, score, local: localId, online: { mine, best } });
  renderer.render(scene, rig.camera);
});

// Dev-only console hooks for debugging (`spaceblast.state`, `spaceblast.startLevel(n)`)
// in the browser console. Stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(window, {
    spaceblast: {
      get state() { return state; },
      hash: () => hashState(state),
      /** Jump straight to a story level, e.g. spaceblast.startLevel(15). */
      startLevel(n: number, story = false) { mode = 'survival'; level = n; screens.hideMenu(); beginLevel(story); },
      dev,
    },
  });
}
