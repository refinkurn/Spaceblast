import { Announcer } from './flow/announcer';
import { Cinematic, Recorder } from './flow/cinematic';
import { Cutscene } from './flow/cutscene';
import { Congrats, type Standing } from './flow/congrats';
import { DevPanel } from './flow/dev';
import { setupFullscreen } from './flow/fullscreen';
import { boardLeftAt, Hud, HUD_MAX_SCALE, HUD_PANEL_H, hudScale } from './flow/hud';
import { haptics } from './flow/haptics';
import { parseRoomParam } from './flow/invite';
import { Countdown } from './flow/countdown';
import { RadioToasts } from './flow/radio_toast';
import { PauseMenu } from './flow/pause';
import { battleSummary, type BannerExtra } from './flow/summary';
import { OnlineRoom, type RoundStart } from './flow/online';
import { MatchScore, OnlineRound } from './flow/online_match';
import { Predictor } from './net/predict';
import { NetStats } from './flow/net_stats';
import { Screens, type MenuChoice } from './flow/screens';
import { CONTROL_SCALE, SettingsScreen } from './flow/settings';
import { GameAudio } from './flow/sound';
import { StoryMode } from './flow/story_mode';
import { installMultiTouchTaps } from './flow/taps';
import { fadeThrough } from './flow/transition';
import { Tutorial, randomTip } from './flow/tutorial';
import { BATTLE_TIPS } from './flow/tutorial_script';
import { Bot } from './input/bot';
import { readLocalCommand } from './input/commands';
import { KeyboardSource } from './input/keyboard';
import { TouchSource } from './input/touch';
import type { PlayerCommand } from './sim/command';
import { GOD_SHIELD, MAX_BOOTS, MAX_CHARGES, MAX_RANGE, TICK_MS, TICK_RATE } from './sim/constants';
import { levelSpec } from './sim/levels';
import { hashState, step } from './sim/sim';
import { createGame, holdLeft, playerTile, type GameState, type SimEvent } from './sim/state';
import { GameView } from './view/game_view';
import { applyDom, t } from './utils/i18n';

// Wiring: game modes (Story, Battle vs bot, online rooms), the round flow and
// the fixed 60 Hz loop. Rendering lives in view/game_view.ts, online rounds in
// flow/online_match.ts, the round-end cinematic in flow/cinematic.ts.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** You (blue), the rival (orange: battle bot or the Renegade Pilot), then players 3 and 4. */
const HERO_COLORS = [0x3a7bff, 0xff6a3d, 0x4fd17a, 0xc77dff];
/** Battle vs bot: round wins to take the match. */
const BATTLE_WINS = 3;

const view = new GameView($<HTMLCanvasElement>('game'));
const keys = new KeyboardSource();
const touch = new TouchSource($('stick-zone'), $('stick-base'), $('stick-knob'), $('place-btn'));

// --- Session -----------------------------------------------------------------------
let mode: MenuChoice = 'survival';
let state: GameState;
let bot: Bot | null = null;
/** The game waits while the level card is up. */
let cardUp = false;
/** Battle round wins (offline and online). */
const score = new MatchScore();
/** The online round being played; null outside online play. */
let net: OnlineRound | null = null;
const predictor = new Predictor();
/** Online stats line (ping, buffer, frame rate) for diagnosing lag on real phones. */
const netStats = new NetStats();
/** Sim player id of this browser's astronaut (always 0 offline). */
let localId = 0;
let lastWinner = -1;
/** Set when a run was started from the developer level select; enables its cheats. */
let devRun = false;

const screens = new Screens(startMode, openMenu, pauseButton);
const hud = new Hud();
// Static labels in index.html take their words from src/config/locales.json.
applyDom();
const countdown = new Countdown();
/** Captain Kit's one-line radio toasts (Story only). */
const radio = new RadioToasts();
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
const cutscene = new Cutscene((cue) => audio.cue(cue));
const story = new StoryMode({
  newLevel: () => { newGame(); return state; },
  get state() { return state; },
  showLevelCard: (card) => {
    cardUp = true;
    screens.showLevelCard(card);
  },
  beginPlay: () => beginStoryPlay(),
  openMenu,
}, screens, cutscene, view);
/** Story tutorial coach; starts when a level's card closes. */
const tutorial = new Tutorial(story.progress.beats);
$('settings-tutorial').addEventListener('click', () => {
  story.progress.resetTutorial();
  $('settings-tutorial').querySelector('span')!.textContent = t('settings.tutorialReset');
});
const settings = new SettingsScreen((s) => {
  audio.setVolumes(s.music, s.sfx);
  touch.setScale(CONTROL_SCALE[s.controls]);
  touch.setMode(s.joystick);
  haptics.enabled = s.vibration;
  view.rig.shakeOn = s.screenShake;
});
const dev = new DevPanel(startAtLevel);
const pause = new PauseMenu({
  restart: () => fadeThrough(() => {
    pause.close();
    if (mode === 'battle') newGame(); else story.play(story.level, false);
  }),
  settings: (back) => screens.openSettingsOver(back),
  quit: openMenu,
});

/** The pause card can open during live offline play only; online keeps the leave prompt. */
function canPause(): boolean {
  return mode !== 'online' && state.status === 'playing' && !screens.menuOpen && !screens.bannerOpen && !cardUp
    && !story.cardOpen && !cutscene.active && !cine.active && !congrats.open && !story.overlayOpen;
}

/** The HUD's top-right button. */
function pauseButton() {
  if (pause.open) pause.close();
  else if (canPause()) pause.show(mode);
  else openMenu();
}
// Offline, the game pauses itself when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !pause.open && canPause()) pause.show(mode);
});
setupFullscreen();
installMultiTouchTaps();

/** Developer level select: jump straight to a Story level. */
function startAtLevel(n: number) {
  mode = 'survival';
  devRun = true;
  dev.hide();
  screens.hideMenu();
  story.play(n, dev.opts.story);
}

/** A menu choice: the new screen (Story map, a battle arena, the online lobby) comes in through a quick black fade. */
function startMode(m: MenuChoice) {
  fadeThrough(() => startModeNow(m));
}

function startModeNow(m: MenuChoice) {
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
    screens.showBanner(t('online.leaveTitle'), t('online.leaveText', { code: online.code }), t('online.keepPlaying'), () => {
      leaveAsked = false;
      screens.hideBanner();
    }, t('online.leave'));
    return;
  }
  fadeThrough(showMenuNow);
}

/** Drops whatever is on screen and shows the main menu (no fade: also used under the splash at load). */
function showMenuNow() {
  leaveAsked = false;
  countdown.cancel();
  pause.close();
  cine.stop();
  cutscene.cancel();
  story.closeOverlays();
  congrats.hide();
  if (online.connected) online.exit(''); // leaving the room; onExit comes back here
  else screens.showMenu();
}

// --- A new map ----------------------------------------------------------------------------
function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
  tutorial.stop();
  story.cancelCards();
  // Math.random is fine HERE: it only picks the seed. Inside sim/ it is banned.
  const spec = levelSpec(story.level);
  if (mode === 'online' && net) state = createGame(seed, net.gameOptions());
  else if (mode === 'battle') state = createGame(seed, { mode: 'battle' });
  else state = createGame(seed, { roster: spec.roster, rules: spec.rules, boss: spec.boss, rival: spec.rival });
  if (devRun && mode === 'survival') applyCheats();
  bot = mode === 'battle' ? new Bot(1, seed, screens.botLevel) : spec.rival ? new Bot(1, seed, 'hard') : null;
  recorder.reset();
  radio.reset();
  view.build(state, colors(), mode === 'online' ? localId : -1);
  view.rig.reset();
  screens.hideBanner();
  screens.hideLevelCard();
  cardUp = false;
  leaveAsked = false;
  countdown.cancel();
  pause.close();
  clearPresses();
  // Offline Battle rounds count in right away; Story levels count in when their card closes.
  if (mode === 'battle') countdown.start();
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
    if (!quiet) view.effect(e, state);
    onEvent(e);
  }
  if (!quiet) audio.events(state, localId);
  if (mode === 'survival') {
    tutorial.tick(state);
    story.tick(state);
    // Toasts first: a power-up's first pick-up gets its card from story.event, not a toast.
    for (const e of state.events) radio.event(e, state, (item) => story.powerupSeen(item));
    for (const e of state.events) story.event(e);
  }
}

function localCommands(): PlayerCommand[] {
  const local = readLocalCommand(keys, touch);
  return bot ? [local, bot.think(state)] : [local];
}

function onEvent(e: SimEvent) {
  switch (e.type) {
    case 'charge_placed': {
      // A short buzz when your own astronaut sets a Charge (it appears on your tile).
      const me = state.players[localId];
      if (me && !quiet) {
        const [tx, ty] = playerTile(me);
        if (tx === e.tx && ty === e.ty) haptics.buzz(30);
      }
      break;
    }
    case 'item_picked':
      // A light tap when your astronaut grabs a power-up.
      if (e.id === localId && !quiet) haptics.buzz(15);
      break;
    case 'armor_hit':
      announcer.flash(t('alert.vestHit'));
      break;
    case 'gate_moved':
      announcer.flash(e.hidden ? t('alert.gateMovedHidden') : t('alert.gateMoved'));
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
  if (id === localId) return t('common.you');
  return net && mode === 'online' ? net.names[id] : t('battle.theBot');
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
  const title = winner < 0 ? t('battle.drawTitle') : winner === localId ? t('battle.youWin') : t('battle.wins', { name: playerName(winner) });
  cine.start(state, {
    winner,
    kicker: t('battle.round', { n: score.round }),
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
  const line = lastWinner < 0 ? t('battle.roundDraw') : lastWinner === localId ? t('battle.youWinRound') : t('battle.winsRound', { name: playerName(lastWinner) });
  const big = lastWinner < 0 ? t('banner.draw') : lastWinner === localId ? t('banner.victory') : t('banner.defeated');
  const extra: BannerExtra = { pose: lastWinner < 0 ? 'neutral' : lastWinner === localId ? 'happy' : 'defeated', summary: battleSummary(state, tally()) };
  const goal = t('battle.firstTo', { n: winsNeeded() });
  const menu = t('banner.mainMenu');
  if (mode !== 'online') {
    screens.showBanner(big, `${line} · ${goal}`, t('banner.nextRound'), () => fadeThrough(() => { score.nextRound(false); newGame(); }), menu, randomTip(BATTLE_TIPS), extra);
  } else if (online.total < 2) {
    screens.showBanner(big, `${line} · ${t('battle.everyoneLeft')}`, t('banner.backToRoom'), () => { screens.hideBanner(); online.showLobby(); }, menu, '', extra);
  } else if (online.isHost) {
    screens.showBanner(big, `${line} · ${goal}`, t('banner.nextRound'), () => online.startRound(), menu, randomTip(BATTLE_TIPS), extra);
  } else {
    screens.showBanner(big, `${line} · ${goal}`, t('banner.waitingHost'), () => {}, menu, randomTip(BATTLE_TIPS), extra);
  }
}

function showMatchWinner() {
  const keyList = playerKeys();
  const cols = colors();
  const standings: Standing[] = keyList.map((key, id) => ({
    name: net && mode === 'online' ? net.names[id] : id === 0 ? t('common.you') : t('common.bot'),
    color: cols[id],
    wins: score.of(key),
    you: id === localId,
  }));
  const winner = standings.find((s) => s.wins >= winsNeeded()) ?? null;
  if (mode === 'online') {
    congrats.show(winner, standings, [{ label: t('banner.backToRoom'), primary: true, onClick: () => { congrats.hide(); online.showLobby(); } }]);
  } else {
    congrats.show(winner, standings, [
      { label: t('banner.playAgain'), primary: true, onClick: () => fadeThrough(() => { congrats.hide(); startModeNow('battle'); }) },
      { label: t('banner.menu'), onClick: openMenu },
    ]);
  }
}

// --- Online rooms --------------------------------------------------------------------
online.onRoundStart = (s: RoundStart) => {
  const resume = s.frames !== undefined;
  const sameRound = resume && mode === 'online' && net?.r === s.r;
  // Reconnected into a round this browser already finished: nothing to catch up.
  if (sameRound && state.status !== 'playing') return;
  // A new round while this browser is a few ticks behind: finish the old one first, so every score agrees.
  if (!resume) while (mode === 'online' && net && state.status === 'playing' && net.sync.ready()) onlineStep();
  cine.stop();
  congrats.hide();
  if (!sameRound) score.nextRound(mode !== 'online');
  mode = 'online';
  net = new OnlineRound(s);
  predictor.reset();
  localId = s.local;
  screens.hideMenu();
  newGame(s.seed);
  if (resume) catchUp();
};
online.onFrames = (r, tick, c) => net?.receive(r, tick, c);
online.onLeft = () => {
  if (mode === 'online' && screens.bannerOpen) showRoundScore(); // the host may have changed
};
online.onAway = (slot, away) => {
  const name = net?.humans.find((p) => p.slot === slot)?.name ?? t('online.aPlayer');
  announcer.flash(away ? t('online.playerAway', { name }) : t('online.playerBack', { name }));
};
online.onReconnecting = (on) => {
  $('reconnect-text').textContent = t('online.reconnectingTo', { code: online.code });
  $('reconnect').hidden = !on;
  if (!on) announcer.flash(t('online.reconnected'));
};
online.onHash = (r, tick, h) => {
  if (net?.otherHash(r, tick, h)) desync(tick);
};
online.onExit = (reason) => {
  $('reconnect').hidden = true;
  net = null;
  cine.stop();
  congrats.hide();
  if (mode === 'online') mode = 'battle';
  localId = 0;
  if (!reason) fadeThrough(() => {
    newGame();
    screens.showMenu();
  });
};

/** Quiet ticks (catching up after a reconnect): no effects, sounds or hash messages. */
let quiet = false;

/** Runs the next online tick if the server's frame for it has arrived. Returns false while waiting. */
function onlineStep(): boolean {
  if (!net || state.status !== 'playing') return true;
  const cmds = net.commands(state);
  if (!cmds) return false;
  runTick(cmds);
  if (state.tick % 60 === 0 && !quiet) {
    const h = hashState(state);
    online.sendHash(net.r, state.tick, h);
    if (net.ownHash(state.tick, h)) desync(state.tick);
  }
  return true;
}

/** Reconnected: replay the round so far at full speed, then show where it stands. */
function catchUp() {
  quiet = true;
  while (net && state.status === 'playing' && net.sync.ready()) onlineStep();
  quiet = false;
  view.build(state, colors(), localId);
}

/** Per frame: aim this browser's command at the server, and watch the connection. */
function onlineFrame(now: number) {
  if (!net) return;
  const sync = net.sync;
  // Aim for a ping spike, not the average: a press that misses its tick is replaced by the last one.
  sync.setRtt(online.rtt + 2 * online.rttSpread);
  if (state.status === 'playing') {
    net.input(readLocalCommand(keys, touch));
    // Commands go out in pairs (30 messages a second) to keep server costs down.
    const out = sync.takeOutgoing(2);
    if (out) online.sendInput(net.r, out.tick, out.c);
    // No frames for 4 s on an open connection: it's stuck, reconnect.
    if (!online.reconnecting && sync.lastFrameAt > 0 && now - sync.lastFrameAt > 4000) online.retryNow();
  } else if (!net.overSent) {
    net.overSent = true;
    online.sendOver(net.r);
  }
}

/** The small note about this browser's connection, or ''. */
function connectionNote(now: number): string {
  if (!net || state.status !== 'playing') return '';
  if (online.reconnecting) return t('net.lost');
  if (net.sync.lastFrameAt > 0 && now - net.sync.lastFrameAt > 1000) return t('net.waitingServer');
  if (online.rtt > 250) return t('net.weak', { ms: Math.round(online.rtt) });
  return '';
}

function desync(tick: number) {
  console.error(`Online desync at tick ${tick}`);
  announcer.flash(t('net.desync'));
}

// --- Keys, taps, layout -------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (screens.menuOpen || online.screenOpen || story.overlayOpen) return;
  // Held keys repeat: a held Enter must not press "Next round" again and again.
  if (e.repeat) return;
  if (pause.open) {
    if (e.code === 'Escape' || e.code === 'KeyP') pause.close();
    return;
  }
  if (e.code === 'KeyP' && canPause()) { pause.show(mode); return; }
  const confirm = e.code === 'Enter' || e.code === 'Space';
  if (e.code === 'Escape') { if (canPause()) pause.show(mode); else openMenu(); }
  else if (cutscene.active) {
    if (confirm) cutscene.advance();
  } else if (story.cardOpen) {
    if (confirm) story.pressCard();
  } else if (cine.active) {
    if (e.code === 'Enter') cine.skip(); // not Space: that's the charge key
  }
  else if (confirm && congrats.open) congrats.pressPrimary();
  else if (confirm && screens.storyOpen) screens.pressStory();
  else if (confirm && screens.bannerOpen) screens.pressPrimary();
  else if (confirm && cardUp) skipCard();
});
$('level-card').addEventListener('click', skipCard);
$('game').addEventListener('pointerdown', () => cine.skip());

/** Tap or Enter closes the level card. */
function skipCard() {
  if (!cardUp) return;
  cardUp = false;
  screens.hideLevelCard();
  if (mode === 'survival') beginStoryPlay();
}

/** The Story level really starts now (level card closed, or entered from the map): coach tips, then the count. */
function beginStoryPlay() {
  tutorial.start(story.level, state);
  // Level 1's first coach prompt keeps its timing, so no count there.
  if (!tutorial.startPending) countdown.start();
}

/** The notch / home-bar insets (env(safe-area-inset-*)), read off a hidden probe. */
/** The HUD's top-left stats panel, sized in layout() from the room beside the board. */
const hudPanel = document.querySelector('.hud-left') as HTMLElement;
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.append(safeProbe);
let laidOut = '';
let insets = { left: 0, right: 0, top: 0 };

/**
 * Fits the camera to the canvas as it is really shown. The size is measured from
 * the canvas itself, every frame: iOS can report a stale window size after a
 * rotation or a toolbar change, and a renderer sized from that is drawn squashed.
 * Gutter width for the touch controls: about 16% of the width, 110-170 px, plus the notch.
 */
function layout(remeasure = false) {
  const canvas = view.renderer.domElement;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (remeasure || !laidOut) {
    const safe = getComputedStyle(safeProbe);
    insets = { left: parseFloat(safe.paddingLeft) || 0, right: parseFloat(safe.paddingRight) || 0, top: parseFloat(safe.paddingTop) || 0 };
  }
  const key = `${w}x${h}|${insets.left}|${insets.right}|${insets.top}`;
  if (key === laidOut) return;
  laidOut = key;
  const gutter = Math.round(Math.min(170, Math.max(110, w * 0.16)));
  const hudHeight = 44;
  document.documentElement.style.setProperty('--gutter', `${gutter}px`);
  document.documentElement.style.setProperty('--hud', `${hudHeight}px`);
  view.layout(w, h, gutter + insets.left, gutter + insets.right, hudHeight + insets.top);
  // Stats panel: as big (up to 1.3x) and wide as the space between its left edge and the board allows,
  // measured where the board's slanted left edge is at the bottom of a full-size panel.
  const panelBottom = hudPanel.offsetTop + HUD_PANEL_H * HUD_MAX_SCALE;
  const room = Math.round(boardLeftAt(view.rig.leftEdge, panelBottom) - hudPanel.offsetLeft - 10);
  document.documentElement.style.setProperty('--hud-scale', String(hudScale(room)));
  document.documentElement.style.setProperty('--hud-room', `${Math.max(0, room)}px`);
}
const relayout = () => layout(true);
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => setTimeout(relayout, 300));
window.visualViewport?.addEventListener('resize', relayout);
layout(true);

// --- Fixed-timestep loop -----------------------------------------------------------
// A map plays behind the start screen; the sim waits while any card or the menu is open.
// Both are set up under the splash, so no fade here.
newGame();
showMenuNow();
// An invite link (?room=CODE) opens Multiplayer with the code filled in.
{
  const invited = parseRoomParam(window.location.search);
  if (invited) {
    startModeNow('online');
    online.prefillCode(invited);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      history.replaceState(null, '', url);
    } catch { /* keep the address as it is */ }
  }
}
let acc = 0;
let last = performance.now();
let wasPaused = false;
const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
/**
 * 120 Hz+ screens would draw every frame twice as often as the 60 Hz sim needs:
 * skipping frames closer than this draws every other frame (120 Hz -> 60 fps,
 * 144 Hz -> 72) while 60 and 90 Hz screens keep every frame. That saves battery
 * and keeps phones from heating up and throttling mid-match.
 */
const MIN_FRAME_MS = 10;
view.renderer.setAnimationLoop((now: number) => {
  if (now - last < MIN_FRAME_MS) return;
  const workStart = performance.now();
  const frameMs = now - last;
  layout(); // reads the canvas size only; catches sizes iOS never announced
  view.frameTime(frameMs);
  const dt = Math.min(now - last, 250);
  last = now;
  acc += dt;
  const overlay = screens.menuOpen || screens.storyOpen || online.screenOpen || congrats.open || story.overlayOpen;
  // Offline games pause while the phone is upright (the "rotate" screen is up).
  const upright = portrait.matches && mode !== 'online';
  const paused = overlay || pause.open || upright || cardUp || countdown.active || story.cardOpen || cine.active || cutscene.active || (mode === 'online' && !net);
  // Something took over the screen: let go of the stick and the charge button.
  // Coming back: forget presses made meanwhile (Space on a card must not drop a charge).
  if (paused && !wasPaused) touch.release();
  if (!paused && wasPaused) clearPresses();
  wasPaused = paused;
  tutorial.update(!paused && mode === 'survival' && state.status === 'playing');
  let steps = 0;
  if (!paused && mode === 'online' && net) {
    // The server's frames, played at an even pace behind a small jitter reserve (net/frames.ts).
    const n = net.sync.pace(Math.floor(acc / TICK_MS));
    while (steps < n && onlineStep()) steps++;
    // Waiting for frames must not bank time for a burst later.
    acc = steps === 0 ? Math.min(acc, TICK_MS) : Math.max(0, acc - steps * TICK_MS);
  } else {
    while (acc >= TICK_MS && steps < 5) {
      if (!paused) {
        runTick(localCommands());
        if (story.cardOpen) break; // a power-up card just opened: stop right here
      }
      acc -= TICK_MS;
      steps++;
    }
    if (steps === 5) acc = 0; // too far behind (tab was hidden): drop the backlog
  }
  onlineFrame(now);
  const seconds = dt / 1000;
  // During the cinematic the view shows its replay (or the final moment).
  cutscene.update(seconds);
  if (!overlay && !pause.open && !upright) countdown.update(seconds);
  // Online the sim holds the round's start (sim/state.ts holdLeft) and the count
  // follows its tick, so every phone shows the same step. It never pauses: frames keep flowing.
  const counting = mode === 'online' && !!net && state.status === 'playing' && holdLeft(state) > 0;
  countdown.follow(counting && !overlay && !screens.bannerOpen && !cine.active ? state.tick / TICK_RATE : null);
  // Scenes hide the HUD and touch controls.
  document.body.classList.toggle('scene', cutscene.active || cine.active || story.endingOpen);
  const alpha = cine.active ? cine.update(seconds) : paused ? 1 : acc / TICK_MS;
  // Online: your own astronaut is drawn from your latest presses (net/predict.ts).
  const predicted = !paused && !cine.active && mode === 'online' && net ? predictor.run(state, net.sync, localId) : null;
  view.render(cine.state ?? state, alpha, seconds, now / 1000, predicted && { id: localId, p: predicted });
  netStats.update(now, frameMs, performance.now() - workStart, mode === 'online' && net && state.status === 'playing' ? {
    where: online.where, rtt: online.rtt, spread: online.rttSpread, reserve: net.sync.reserve,
    buffered: net.sync.buffered, late: net.sync.lateInputs, ahead: predictor.ahead,
  } : null);
  announcer.update(state, now, connectionNote(now), overlay || cine.active || cutscene.active);
  // Kit waits while anything else owns the moment or the lane under the HUD.
  radio.update(now, mode !== 'survival' || paused || pause.open || countdown.active || state.status !== 'playing'
    || !$('alert').hidden || !$('announce').hidden || !$('coach').hidden);
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
      view,
      hash: () => hashState(state),
      /** Jump straight to a story level, e.g. spaceblast.startLevel(15). */
      startLevel(n: number, withStory = false) { mode = 'survival'; screens.hideMenu(); story.play(n, withStory); },
      story,
      dev,
      cine,
    },
  });
}
