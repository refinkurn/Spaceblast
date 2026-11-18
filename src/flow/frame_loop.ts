import type { Announcer } from './announcer';
import type { BossCountdown } from './boss_countdown';
import type { Cinematic } from './cinematic';
import type { Congrats } from './congrats';
import type { Countdown } from './countdown';
import type { Cutscene } from './cutscene';
import type { Hud } from './hud';
import type { MatchScore } from './online_match';
import type { NetStats } from './net_stats';
import type { OnlineRoom } from './online';
import type { PauseMenu } from './pause';
import type { RadioToasts } from './radio_toast';
import type { Screens } from './screens';
import type { GameAudio } from './sound';
import type { StoryMode } from './story_mode';
import type { Tutorial } from './tutorial';
import { session } from './session';
import type { Predictor } from '../net/predict';
import type { TouchSource } from '../input/touch';
import { TICK_MS, TICK_RATE } from '../sim/constants';
import { levelSpec } from '../sim/levels';
import { holdLeft } from '../sim/state';
import type { GameView } from '../view/game_view';
import type { PlayerCommand } from '../sim/command';
import { setGameplay } from '../services/crazygames';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface FrameLoopDeps {
  view: GameView; screens: Screens; online: OnlineRoom; congrats: Congrats; story: StoryMode; pause: PauseMenu;
  cine: Cinematic; cutscene: Cutscene; countdown: Countdown; touch: TouchSource; tutorial: Tutorial;
  announcer: Announcer; radio: RadioToasts; audio: GameAudio; bossClock: BossCountdown; hud: Hud;
  score: MatchScore; netStats: NetStats; predictor: Predictor;
  clearPresses: () => void; runTick: (c: PlayerCommand[]) => void; localCommands: () => PlayerCommand[];
  onlineStep: () => boolean; onlineFrame: (now: number) => void; connectionNote: (now: number) => string;
  playerKeys: () => string[];
  layout: () => void;
}

/** The fixed-timestep loop: 60 Hz sim steps, online frames, then one draw per animation frame. */
export function installFrameLoop(d: FrameLoopDeps) {
  const {
    view, screens, online, congrats, story, pause, cine, cutscene, countdown, touch, tutorial, announcer, radio,
    audio, bossClock, hud, score, netStats, predictor, clearPresses, runTick, localCommands, onlineStep, onlineFrame,
    connectionNote, playerKeys, layout,
  } = d;
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
    setGameplay(!paused && session.state.status === 'playing'); // CrazyGames: a no-op unless the SDK is up
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
}
