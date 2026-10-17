import { Announcer } from './flow/announcer';
import { Cinematic, Recorder } from './flow/cinematic';
import { Cutscene } from './flow/cutscene';
import { Congrats, type Standing } from './flow/congrats';
import { DevPanel, GOD_SHIELD } from './flow/dev';
import { setupFullscreen } from './flow/fullscreen';
import { Hud } from './flow/hud';
import { OnlineRoom, type RoundStart } from './flow/online';
import { MatchScore, OnlineRound } from './flow/online_match';
import { Screens, type MenuChoice } from './flow/screens';
import { CONTROL_SCALE, SettingsScreen } from './flow/settings';
import { GameAudio } from './flow/sound';
import { StoryMode } from './flow/story_mode';
import { Bot } from './input/bot';
import { readLocalCommand } from './input/commands';
import { KeyboardSource } from './input/keyboard';
import { TouchSource } from './input/touch';
import type { PlayerCommand } from './sim/command';
import { MAX_BOOTS, MAX_CHARGES, MAX_RANGE, TICK_MS } from './sim/constants';
import { levelSpec } from './sim/levels';
import { hashState, step } from './sim/sim';
import { createGame, type GameState, type SimEvent } from './sim/state';
import { GameView } from './view/game_view';

// Wiring: game modes (Story, Battle vs bot, online rooms), the round flow and
// the fixed 60 Hz loop. Rendering lives in view/game_view.ts, online rounds in
// flow/online_match.ts, the round-end cinematic in flow/cinematic.ts.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** You (blue), the rival (orange: battle bot or the Renegade Pilot), then players 3 and 4. */
const HERO_COLORS = [0x3a7bff, 0xff6a3d, 0x4fd17a, 0xc77dff];
/** How long the level briefing stays up (the game waits meanwhile). */
const CARD_MS = 3000;
/** Battle vs bot: round wins to take the match. */
const BATTLE_WINS = 3;

const view = new GameView($<HTMLCanvasElement>('game'));
const keys = new KeyboardSource();
const touch = new TouchSource($('stick-zone'), $('stick-base'), $('stick-knob'), $('place-btn'));

// --- Session -----------------------------------------------------------------------
let mode: MenuChoice = 'survival';
let state: GameState;
let bot: Bot | null = null;
/** The game waits while the briefing card is up. */
let cardUntil = 0;
/** Battle round wins (offline and online). */
const score = new MatchScore();
/** The online round being played; null outside online play. */
let net: OnlineRound | null = null;
/** Sim player id of this browser's astronaut (always 0 offline). */
let localId = 0;
let lastWinner = -1;
/** When the game last told the room it is running, and since when it has been waiting for input. */
let lastAlive = 0;
let waitingSince = 0;
/** Set when a run was started from the developer level select; enables its cheats. */
let devRun = false;

const screens = new Screens(startMode, openMenu);
const hud = new Hud();
const online = new OnlineRoom();
const announcer = new Announcer();
const congrats = new Congrats();
const recorder = new Recorder();
/** Sound starts on the tap-to-start screen (the menu is already open behind it). */
const audio = new GameAudio(() => {});
const cine = new Cinematic(view, recorder, (s) => {
  for (const e of s.events) view.effect(e, s);
  audio.events(s, localId);
});
const cutscene = new Cutscene(view);
const story = new StoryMode({
  newLevel: () => { newGame(); return state; },
  get state() { return state; },
  showBriefing: (title, context, goal, hazards) => {
    screens.showLevelCard(title, context, goal, hazards);
    cardUntil = performance.now() + CARD_MS;
  },
  openMenu,
}, screens, cutscene, view);
const settings = new SettingsScreen((s) => {
  audio.setVolumes(s.music, s.sfx);
  touch.setScale(CONTROL_SCALE[s.controls]);
});
const dev = new DevPanel(startAtLevel);
setupFullscreen();

/** Developer level select: jump straight to a Story level. */
function startAtLevel(n: number) {
  mode = 'survival';
  devRun = true;
  dev.hide();
  screens.hideMenu();
  story.play(n, dev.opts.story);
}

function startMode(m: MenuChoice) {
  if (m === 'online') {
    screens.hideMenu();
    online.open();
    return;
  }
  mode = m;
  localId = 0;
  devRun = false;
  screens.hideMenu();
  if (mode === 'battle') {
    score.nextRound(true);
    newGame();
  } else {
    story.open();
  }
}

/** Online: the first Menu press mid-round asks before leaving the room. */
let leaveAsked = false;

function openMenu() {
  if (online.connected && mode === 'online' && net && state.status === 'playing' && !leaveAsked) {
    leaveAsked = true;
    screens.showBanner('Leave the match?', `You'll leave room ${online.code}, and your astronaut is out for this round.`, 'Keep playing', () => {
      leaveAsked = false;
      screens.hideBanner();
    }, 'Leave');
    return;
  }
  leaveAsked = false;
  cine.stop();
  cutscene.cancel();
  story.closeOverlays();
  settings.close();
  congrats.hide();
  if (online.connected) online.exit(''); // leaving the room; onExit comes back here
  else screens.showMenu();
}

// --- A new map ----------------------------------------------------------------------------
function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
  // Math.random is fine HERE: it only picks the seed. Inside sim/ it is banned.
  const spec = levelSpec(story.level);
  if (mode === 'online' && net) state = createGame(seed, net.gameOptions());
  else if (mode === 'battle') state = createGame(seed, { mode: 'battle' });
  else state = createGame(seed, { roster: spec.roster, rules: spec.rules, boss: spec.boss, rival: spec.rival });
  if (devRun && mode === 'survival') applyCheats();
  bot = mode === 'battle' ? new Bot(1, seed, screens.botLevel) : spec.rival ? new Bot(1, seed, 'hard') : null;
  recorder.reset();
  view.build(state, colors(), mode === 'online' ? localId : -1);
  view.rig.reset();
  screens.hideBanner();
  screens.hideLevelCard();
  cardUntil = 0;
  leaveAsked = false;
  clearPresses();
}

/** Drops charge presses queued before the round could see them. */
function clearPresses() {
  keys.clearPlace();
  touch.readPlace();
}

/** Astronaut colours: the room's picks online, else blue for you and orange for the rival. */
function colors(): number[] {
  return mode === 'online' && net ? net.colors : HERO_COLORS;
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

/** Runs one tick with these commands, then its effects, sounds and results. */
function runTick(cmds: PlayerCommand[]) {
  recorder.before(state, cmds);
  view.snapshot(state);
  step(state, cmds);
  recorder.after(state);
  for (const e of state.events) {
    view.effect(e, state);
    onEvent(e);
  }
  audio.events(state, localId);
  if (mode === 'survival') {
    story.tick();
    for (const e of state.events) story.event(e);
  }
}

function localCommands(): PlayerCommand[] {
  const local = readLocalCommand(keys, touch);
  return bot ? [local, bot.think(state)] : [local];
}

function onEvent(e: SimEvent) {
  switch (e.type) {
    case 'armor_hit':
      announcer.flash('Oxygen Vest absorbed the hit!');
      break;
    case 'gate_moved':
      announcer.flash(e.hidden ? 'The Warp Gate moved under a rock!' : 'The Warp Gate moved!');
      break;
    case 'round_over':
      roundOver(e.winner);
      break;
  }
}

// --- Battle rounds (offline and online) ---------------------------------------------------
function playerKeys(): string[] {
  return net && mode === 'online' ? net.keys : ['p0', 'p1'];
}

function playerName(id: number): string {
  if (id === localId) return 'You';
  return net && mode === 'online' ? net.names[id] : 'The bot';
}

function winsNeeded(): number {
  return net && mode === 'online' ? net.winsNeeded : BATTLE_WINS;
}

/** A round ended: count the win, play the cinematic, then the score or the match result. */
function roundOver(winner: number) {
  if (winner >= 0) score.win(playerKeys()[winner], winsNeeded());
  lastWinner = winner;
  const length = settings.value.cinematic;
  if (length === 'off') {
    afterRound();
    return;
  }
  const title = winner < 0 ? 'Draw!' : winner === localId ? 'You win!' : `${playerName(winner)} wins!`;
  cine.start(state, {
    winner,
    kicker: `Round ${score.round}`,
    title,
    color: winner >= 0 ? colors()[winner] : 0xffffff,
    colors: colors(),
    local: mode === 'online' ? localId : -1,
    replay: length === 'full',
  }, afterRound);
}

function afterRound() {
  if (score.over) showMatchWinner();
  else showRoundScore();
}

function tally(): string {
  return playerKeys().map((key, id) => `${playerName(id)} ${score.of(key)}`).join(' · ');
}

function showRoundScore() {
  const title = lastWinner < 0 ? 'Draw' : lastWinner === localId ? 'You win the round!' : `${playerName(lastWinner)} wins the round`;
  const goal = `First to ${winsNeeded()} wins`;
  if (mode !== 'online') {
    screens.showBanner(title, `${tally()} · ${goal}`, 'Next round', () => { score.nextRound(false); newGame(); });
  } else if (online.total < 2) {
    screens.showBanner(title, `${tally()} · Everyone else left.`, 'Back to room', () => { screens.hideBanner(); online.showLobby(); });
  } else if (online.isHost) {
    screens.showBanner(title, `${tally()} · ${goal}`, 'Next round', () => online.startRound());
  } else {
    screens.showBanner(title, `${tally()} · ${goal}`, 'Waiting for host…', () => {});
  }
}

function showMatchWinner() {
  const keyList = playerKeys();
  const cols = colors();
  const standings: Standing[] = keyList.map((key, id) => ({
    name: net && mode === 'online' ? net.names[id] : id === 0 ? 'You' : 'Bot',
    color: cols[id],
    wins: score.of(key),
    you: id === localId,
  }));
  const winner = standings.find((s) => s.wins >= winsNeeded()) ?? null;
  if (mode === 'online') {
    congrats.show(winner, standings, [{ label: 'Back to room', primary: true, onClick: () => { congrats.hide(); online.showLobby(); } }]);
  } else {
    congrats.show(winner, standings, [
      { label: 'Play again', primary: true, onClick: () => { congrats.hide(); startMode('battle'); } },
      { label: 'Menu', onClick: openMenu },
    ]);
  }
}

// --- Online rooms --------------------------------------------------------------------
online.onRoundStart = (s: RoundStart) => {
  // A browser a few ticks behind finishes the old round first, so every score agrees.
  while (mode === 'online' && net && state.status === 'playing' && net.lockstep.ready()) onlineStep();
  cine.stop();
  congrats.hide();
  score.nextRound(mode !== 'online');
  mode = 'online';
  net = new OnlineRound(s);
  localId = s.local;
  screens.hideMenu();
  newGame(s.seed);
};
online.onInput = (slot, r, tick, c) => net?.receive(slot, r, tick, c);
online.onLeft = (slot, lastTick) => {
  net?.playerLeft(slot, lastTick);
  if (mode === 'online' && screens.bannerOpen) showRoundScore(); // the host may have changed
};
online.onHash = (r, tick, h) => {
  if (net?.otherHash(r, tick, h)) desync(tick);
};
online.onExit = (reason) => {
  net = null;
  cine.stop();
  congrats.hide();
  if (mode === 'online') mode = 'battle';
  localId = 0;
  if (!reason) {
    newGame();
    screens.showMenu();
  }
};

/** Runs one online tick if everyone's input is in. Returns false while waiting. */
function onlineStep(): boolean {
  if (!net || state.status !== 'playing') return true;
  const cmds = net.commands(readLocalCommand(keys, touch), state);
  if (!cmds) return false;
  runTick(cmds);
  if (state.tick % 60 === 0) {
    const h = hashState(state);
    online.sendHash(net.r, state.tick, h);
    if (net.ownHash(state.tick, h)) desync(state.tick);
  }
  return true;
}

function sendInputs(now: number) {
  if (!net) return;
  const ls = net.lockstep;
  // While the round runs, tell the room we're here (a stalled game sends no inputs).
  if (state.status === 'playing' && now - lastAlive > 1000) {
    online.sendAlive();
    lastAlive = now;
  }
  waitingSince = state.status === 'playing' && !ls.ready() ? waitingSince || now : 0;
  // Waiting on others (or the round is over): send what we have right away.
  const out = ls.takeOutgoing(state.status !== 'playing' || !ls.ready());
  if (out) online.sendInput(net.r, out.tick, out.c);
}

function desync(tick: number) {
  console.error(`Online desync at tick ${tick}`);
  announcer.flash('Out of sync with the other players!');
}

// --- Keys, taps, layout -------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (screens.menuOpen || online.screenOpen || settings.isOpen || story.overlayOpen) return;
  // Held keys repeat: a held Enter must not press "Next round" again and again.
  if (e.repeat) return;
  const confirm = e.code === 'Enter' || e.code === 'Space';
  if (e.code === 'Escape') openMenu();
  else if (cutscene.active) {
    if (confirm) cutscene.advance();
  } else if (cine.active) {
    if (e.code === 'Enter') cine.skip(); // not Space: that's the charge key
  }
  else if (confirm && congrats.open) congrats.pressPrimary();
  else if (confirm && screens.storyOpen) screens.pressStory();
  else if (confirm && screens.bannerOpen) screens.pressPrimary();
  else if (confirm && cardUntil > 0) skipCard();
});
$('level-card').addEventListener('click', skipCard);
$('game').addEventListener('pointerdown', () => cine.skip());

/** Tap or Enter dismisses the briefing early. */
function skipCard() {
  cardUntil = 0;
  screens.hideLevelCard();
}

/** Gutter width for the touch controls: about 16% of the width, 110-170 px. */
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const gutter = Math.round(Math.min(170, Math.max(110, w * 0.16)));
  const hudHeight = 44;
  document.documentElement.style.setProperty('--gutter', `${gutter}px`);
  document.documentElement.style.setProperty('--hud', `${hudHeight}px`);
  view.layout(w, h, gutter, hudHeight);
}
window.addEventListener('resize', layout);
layout();

// --- Fixed-timestep loop -----------------------------------------------------------
// A map plays behind the start screen; the sim waits while any card or the menu is open.
newGame();
openMenu();
let acc = 0;
let last = performance.now();
let wasPaused = false;
const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
view.renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(now - last, 250);
  last = now;
  acc += dt;
  if (cardUntil > 0 && now >= cardUntil) skipCard();
  const overlay = screens.menuOpen || screens.storyOpen || online.screenOpen || congrats.open || settings.isOpen || story.overlayOpen;
  // Offline games pause while the phone is upright (the "rotate" screen is up).
  const upright = portrait.matches && mode !== 'online';
  const paused = overlay || upright || cardUntil > 0 || cine.active || cutscene.active || (mode === 'online' && !net);
  // Something took over the screen: let go of the stick and the charge button.
  // Coming back: forget presses made meanwhile (Space on a card must not drop a charge).
  if (paused && !wasPaused) touch.release();
  if (!paused && wasPaused) clearPresses();
  wasPaused = paused;
  let steps = 0;
  while (acc >= TICK_MS && steps < 5) {
    if (!paused && mode === 'online') {
      if (!onlineStep()) {
        acc = Math.min(acc, TICK_MS); // waiting for another player's input
        break;
      }
    } else if (!paused) {
      runTick(localCommands());
    }
    acc -= TICK_MS;
    steps++;
  }
  if (steps === 5 && mode !== 'online') acc = 0; // too far behind (tab was hidden): drop the backlog
  sendInputs(now);
  const seconds = dt / 1000;
  // During the cinematic the view shows its replay (or the final moment).
  cutscene.update(seconds);
  // Scenes hide the HUD and touch controls.
  document.body.classList.toggle('scene', cutscene.active || cine.active || story.endingOpen);
  const alpha = cine.active ? cine.update(seconds) : paused ? 1 : acc / TICK_MS;
  view.render(cine.state ?? state, alpha, seconds, now / 1000);
  const waiting = net && waitingSince && now - waitingSince > 500 ? net.waitingFor().join(', ') : '';
  announcer.update(state, now, waiting, overlay || cine.active || cutscene.active);
  audio.update(state, screens.menuOpen || online.screenOpen || screens.storyOpen);
  const keyList = playerKeys();
  const mine = score.of(keyList[localId] ?? '');
  const best = Math.max(0, ...keyList.filter((_, i) => i !== localId).map((k) => score.of(k)));
  hud.update(state, {
    mode, level: story.level, sector: levelSpec(story.level).sector, round: score.round,
    score: [score.of('p0'), score.of('p1')], local: localId, online: { mine, best },
  });
});

// Dev-only console hooks for debugging (`spaceblast.state`, `spaceblast.startLevel(n)`)
// in the browser console. Stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(window, {
    spaceblast: {
      get state() { return state; },
      hash: () => hashState(state),
      /** Jump straight to a story level, e.g. spaceblast.startLevel(15). */
      startLevel(n: number, withStory = false) { mode = 'survival'; screens.hideMenu(); story.play(n, withStory); },
      story,
      dev,
      cine,
    },
  });
}
