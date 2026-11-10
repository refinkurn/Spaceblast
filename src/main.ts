import { Announcer } from './flow/announcer';
import { Cinematic, Recorder } from './flow/cinematic';
import { Cutscene } from './flow/cutscene';
import { Congrats } from './flow/congrats';
import { DevPanel } from './flow/dev';
import { setupFullscreen } from './flow/fullscreen';
import { Hud } from './flow/hud';
import { haptics } from './flow/haptics';
import { parseRoomParam } from './flow/invite';
import { registerOfflineCache } from './flow/offline';
import { Countdown } from './flow/countdown';
import { RadioToasts } from './flow/radio_toast';
import { PauseMenu } from './flow/pause';
import { OnlineRoom } from './flow/online';
import { MatchScore } from './flow/online_match';
import { Predictor } from './net/predict';
import { NetStats } from './flow/net_stats';
import { Screens, type MenuChoice } from './flow/screens';
import { CONTROL_SCALE, SettingsScreen } from './flow/settings';
import { GameAudio } from './flow/sound';
import { StoryMode } from './flow/story_mode';
import { installMultiTouchTaps } from './flow/taps';
import { fadeThrough } from './flow/transition';
import { Tutorial } from './flow/tutorial';
import { BossCountdown } from './flow/boss_countdown';
import { installDevHooks } from './flow/dev_hooks';
import { createGameRun, lookOf } from './flow/game_run';
import { createBattleFlow } from './flow/battle_flow';
import { createEventHandler } from './flow/event_handlers';
import { installKeyboardFlow } from './flow/keyboard_flow';
import { installOnlinePlay } from './flow/online_play';
import { installLayout } from './flow/screen_layout';
import { session } from './flow/session';
import { KeyboardSource } from './input/keyboard';
import { TouchSource } from './input/touch';
import { TICK_MS, TICK_RATE } from './sim/constants';
import { levelSpec } from './sim/levels';
import { holdLeft } from './sim/state';
import { GameView } from './view/game_view';
import { applyDom, t } from './utils/i18n';
import { installAnalytics } from './services/analytics';
import { installWebAnalytics } from './services/web_analytics';
import { isPortal, markPortal } from './config/portal';
import { installInputMode } from './input/input_mode';

// Wiring: game modes (Story, Battle vs bot, online rooms) and the fixed 60 Hz loop.
// Shared state lives in flow/session.ts. Rendering is in view/game_view.ts, online rounds in
// flow/online_match.ts + online_play.ts, battle rounds in flow/battle_flow.ts, sim-event
// reactions in flow/event_handlers.ts, sizing in flow/screen_layout.ts.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = new GameView($<HTMLCanvasElement>('game'));
const keys = new KeyboardSource();
const touch = new TouchSource($('stick-zone'), $('stick-base'), $('stick-knob'), $('place-btn'));

// --- Session -----------------------------------------------------------------------
/** Battle round wins (offline and online). */
const score = new MatchScore();
const predictor = new Predictor();
/** Online stats line (ping, buffer, frame rate) for diagnosing lag on real phones. */
const netStats = new NetStats();

const screens = new Screens(startMode, openMenu, pauseButton);
/** The boss level's final 15 s stopwatch. */
const bossClock = new BossCountdown();
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
  audio.events(s, session.localId);
});
const cutscene = new Cutscene((cue) => audio.cue(cue));
const story = new StoryMode({
  newLevel: () => { newGame(); return session.state; },
  get state() { return session.state; },
  showLevelCard: (card) => {
    session.cardUp = true;
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
    if (session.mode === 'battle') newGame(); else story.play(story.level, false);
  }),
  settings: (back) => screens.openSettingsOver(back),
  quit: openMenu,
});
const battle = createBattleFlow({ score, settings, cine, screens, online, congrats, openMenu, startModeNow, newGame: () => run.newGame() });
const { colors, playerKeys } = battle;
const onEvent = createEventHandler({ announcer, roundOver: battle.roundOver });
const run = createGameRun({ view, keys, touch, screens, story, tutorial, recorder, radio, countdown, pause, dev, audio, colors, onEvent });
const { newGame, clearPresses, runTick, localCommands } = run;

/** The pause card can open during live offline play only; online keeps the leave prompt. */
function canPause(): boolean {
  return session.mode !== 'online' && session.state.status === 'playing' && !screens.menuOpen && !screens.bannerOpen && !session.cardUp
    && !story.cardOpen && !cutscene.active && !cine.active && !congrats.open && !story.overlayOpen;
}

/** The HUD's top-right button. */
function pauseButton() {
  if (pause.open) pause.close();
  else if (canPause()) pause.show(session.mode);
  else openMenu();
}
// Offline, the game pauses itself when the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !pause.open && canPause()) pause.show(session.mode);
});
markPortal();
installInputMode();
// A portal provides full screen itself and forbids a button of our own.
if (!isPortal) setupFullscreen();
installMultiTouchTaps();
installAnalytics();
if (!isPortal) installWebAnalytics();

/** Developer level select: jump straight to a Story level. */
function startAtLevel(n: number) {
  session.mode = 'survival';
  session.devRun = true;
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
  session.mode = m;
  session.localId = 0;
  session.devRun = false;
  screens.hideMenu();
  if (m === 'battle') {
    score.nextRound(true);
    newGame();
  } else {
    story.open();
  }
}

function openMenu() {
  if (online.connected && session.mode === 'online' && session.net && session.state.status === 'playing' && !session.leaveAsked) {
    session.leaveAsked = true;
    screens.showBanner(t('online.leaveTitle'), t('online.leaveText', { code: online.code }), t('online.keepPlaying'), () => {
      session.leaveAsked = false;
      screens.hideBanner();
    }, t('online.leave'));
    return;
  }
  fadeThrough(showMenuNow);
}

/** Drops whatever is on screen and shows the main menu (no fade: also used under the splash at load). */
function showMenuNow() {
  session.leaveAsked = false;
  countdown.cancel();
  pause.close();
  cine.stop();
  cutscene.cancel();
  story.closeOverlays();
  congrats.hide();
  if (online.connected) online.exit(''); // leaving the room; onExit comes back here
  else screens.showMenu();
}

// --- Online rooms, keys, taps, layout -------------------------------------------------------
const { onlineStep, onlineFrame, connectionNote } = installOnlinePlay({
  online, cine, congrats, score, screens, predictor, announcer, keys, touch, view,
  newGame, runTick, colors, lookOf, showRoundScore: battle.showRoundScore,
});
installKeyboardFlow({ screens, online, story, pause, cutscene, cine, congrats, canPause, openMenu, skipCard });

/** Tap or Enter closes the level card. */
function skipCard() {
  if (!session.cardUp) return;
  session.cardUp = false;
  screens.hideLevelCard();
  if (session.mode === 'survival') beginStoryPlay();
}

/** The Story level really starts now (level card closed, or entered from the map): coach tips, then the count. */
function beginStoryPlay() {
  tutorial.start(story.level, session.state);
  // Level 1's first coach prompt keeps its timing, so no count there.
  if (!tutorial.startPending) countdown.start();
}

const layout = installLayout(view);

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
  const { mode, net, localId } = session;
  const overlay = screens.menuOpen || screens.storyOpen || online.screenOpen || congrats.open || story.overlayOpen;
  // Offline games pause while the phone is upright (the "rotate" screen is up).
  const upright = portrait.matches && mode !== 'online';
  const paused = overlay || pause.open || upright || session.cardUp || countdown.active || story.cardOpen || cine.active || cutscene.active || (mode === 'online' && !net);
  // Something took over the screen: let go of the stick and the charge button.
  // Coming back: forget presses made meanwhile (Space on a card must not drop a charge).
  if (paused && !wasPaused) touch.release();
  if (!paused && wasPaused) clearPresses();
  wasPaused = paused;
  tutorial.update(!paused && mode === 'survival' && session.state.status === 'playing');
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
  const state = session.state;
  const seconds = dt / 1000;
  // During the cinematic the view shows its replay (or the final moment).
  cutscene.update(seconds);
  if (!overlay && !pause.open && !upright) countdown.update(seconds);
  // Online the sim holds the round's start (sim/state.ts holdLeft) and the count
  // follows its tick, so every phone shows the same step. It never pauses: frames keep flowing.
  const counting = mode === 'online' && !!session.net && state.status === 'playing' && holdLeft(state) > 0;
  countdown.follow(counting && !overlay && !screens.bannerOpen && !cine.active ? state.tick / TICK_RATE : null);
  // Scenes hide the HUD and touch controls.
  document.body.classList.toggle('scene', cutscene.active || cine.active || story.endingOpen);
  const alpha = cine.active ? cine.update(seconds) : paused ? 1 : acc / TICK_MS;
  // Online: your own astronaut is drawn from your latest presses (net/predict.ts).
  const predicted = !paused && !cine.active && mode === 'online' && session.net ? predictor.run(state, session.net.sync, localId) : null;
  view.render(cine.state ?? state, alpha, seconds, now / 1000, predicted && { id: localId, p: predicted });
  const live = session.net;
  netStats.update(now, frameMs, performance.now() - workStart, mode === 'online' && live && state.status === 'playing' ? {
    where: online.where, rtt: online.rtt, spread: online.rttSpread, reserve: live.sync.reserve,
    buffered: live.sync.buffered, late: live.sync.lateInputs, ahead: predictor.ahead,
  } : null);
  announcer.update(state, now, connectionNote(now), overlay || cine.active || cutscene.active);
  // Kit waits while anything else owns the moment or the lane under the HUD.
  radio.update(now, mode !== 'survival' || paused || pause.open || countdown.active || state.status !== 'playing'
    || !$('alert').hidden || !$('announce').hidden || !$('coach').hidden);
  audio.update(state, screens.menuOpen || online.screenOpen || screens.storyOpen);
  const keyList = playerKeys();
  const mine = score.of(keyList[localId] ?? '');
  const best = Math.max(0, ...keyList.filter((_, i) => i !== localId).map((k) => score.of(k)));
  bossClock.update(state, mode !== 'survival' || paused || pause.open || cine.active || cutscene.active);
  hud.update(state, {
    mode, level: story.level, sector: levelSpec(story.level).sector, round: score.round,
    score: [score.of('p0'), score.of('p1')], local: localId, online: { mine, best },
  });
});

// Inside a portal's page there is nothing to install or keep offline.
if (!isPortal) registerOfflineCache();

installDevHooks({ view, story, dev, cine, screens });
