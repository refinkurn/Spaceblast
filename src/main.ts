import { installAdShield } from './flow/ad_shield';
import { Announcer } from './flow/announcer';
import { Cinematic, Recorder } from './flow/cinematic';
import { Cutscene } from './flow/cutscene';
import { Congrats } from './flow/congrats';
import { DevPanel } from './flow/dev';
import { setupFullscreen } from './flow/fullscreen';
import { Hud } from './flow/hud';
import { haptics } from './flow/haptics';
import { installFrameLoop } from './flow/frame_loop';
import { installPortalBoot } from './flow/portal_boot';
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
import { GameView } from './view/game_view';
import { applyDom, t } from './utils/i18n';
import { installAnalytics } from './services/analytics';
import { installWebAnalytics } from './services/web_analytics';
import { inviteRoom } from './services/crazygames';
import { loadingDone } from './services/crazygames_loading';
import { isInstantMultiplayer, onMuteAudio } from './services/crazygames_room';
import { QUICK_START, isPortal, wantsQuickStart } from './config/portal';
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
/** The address the page was opened with (a room invite is removed from it further down). */
const openedWith = window.location.search;
const audio = new GameAudio(() => {
  // Quick start: a first-time portal player skips the menu and plays level 1 at once (inside the splash's fade).
  if (wantsQuickStart(QUICK_START, story.fresh, openedWith, inviteRoom() !== null || isInstantMultiplayer())) fadeThrough(() => { session.mode = 'survival'; screens.hideMenu(); story.coldOpen(); });
});
const cine = new Cinematic(view, recorder, (s) => {
  for (const e of s.events) view.effect(e, s);
  audio.events(s, session.localId);
});
installAdShield((on) => audio.setAdMuted(on));
onMuteAudio((mute) => audio.setPortalMuted(mute)); // CrazyGames muteAudio setting
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
installPortalBoot({ screens, online, story, startModeNow });
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
  if (online.connected) online.leave(); // leaving the room (after a midgame ad if on); onExit comes back here
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
loadingDone(); // the start screen is up: CrazyGames loadingStop
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
installFrameLoop({
  view, screens, online, congrats, story, pause, cine, cutscene, countdown, touch, tutorial, announcer, radio,
  audio, bossClock, hud, score, netStats, predictor, clearPresses, runTick, localCommands, onlineStep, onlineFrame,
  connectionNote, playerKeys, layout,
});

// Inside a portal's page there is nothing to install or keep offline.
if (!isPortal) registerOfflineCache();

installDevHooks({ view, story, dev, cine, screens });
