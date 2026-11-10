import { Bot } from '../input/bot';
import { readLocalCommand } from '../input/commands';
import type { KeyboardSource } from '../input/keyboard';
import type { TouchSource } from '../input/touch';
import type { PlayerCommand } from '../sim/command';
import { GOD_SHIELD, MAX_BOOTS, MAX_CHARGES, MAX_RANGE } from '../sim/constants';
import { levelSpec, storyOptions } from '../sim/levels';
import { step } from '../sim/sim';
import { createGame, type GameState, type SimEvent } from '../sim/state';
import type { GameView } from '../view/game_view';
import type { Recorder } from './cinematic';
import type { Countdown } from './countdown';
import type { DevPanel } from './dev';
import { tally as matchTally } from './match_tally';
import type { PauseMenu } from './pause';
import type { RadioToasts } from './radio_toast';
import type { Screens } from './screens';
import { session } from './session';
import type { GameAudio } from './sound';
import type { StoryMode } from './story_mode';
import type { Tutorial } from './tutorial';

export interface GameRunDeps {
  view: GameView;
  keys: KeyboardSource;
  touch: TouchSource;
  screens: Screens;
  story: StoryMode;
  tutorial: Tutorial;
  recorder: Recorder;
  radio: RadioToasts;
  countdown: Countdown;
  pause: PauseMenu;
  dev: DevPanel;
  audio: GameAudio;
  colors(): number[];
  onEvent(e: SimEvent): void;
}

/** Which sector's look (colours, rocks, props) the arena gets: its layout's sector, 1 for classic. */
export function lookOf(s: GameState): number {
  return s.arena >= 1 && s.arena <= 4 ? s.arena : 1;
}

/** Starting a map, running one sim tick with its effects, and the local player's commands. */
export function createGameRun(d: GameRunDeps) {
  const { view, keys, touch, screens, story, tutorial, recorder, radio, countdown, pause, dev, audio } = d;

  function newGame(seed = (Math.random() * 0xffffffff) >>> 0) {
    tutorial.stop();
    story.cancelCards();
    // Math.random is fine HERE: it only picks the seed. Inside sim/ it is banned.
    const spec = levelSpec(story.level);
    const { mode, net } = session;
    if (mode === 'online' && net) session.state = createGame(seed, net.gameOptions());
    // Battle vs Bot: a random sector arena each round (picked from the seed).
    else if (mode === 'battle') session.state = createGame(seed, { mode: 'battle', arena: 'random' });
    else session.state = createGame(seed, storyOptions(story.level));
    if (session.devRun && mode === 'survival') applyCheats();
    session.bot = mode === 'battle' ? new Bot(1, seed, screens.botLevel) : spec.rival ? new Bot(1, seed, 'hard') : null;
    recorder.reset();
    radio.reset();
    // Each arena takes its sector's look (src/config/sectors.json); the classic arena uses sector 1's.
    view.build(session.state, d.colors(), mode === 'online' ? session.localId : -1, lookOf(session.state));
    view.rig.reset();
    screens.hideBanner();
    screens.hideLevelCard();
    session.cardUp = false;
    session.leaveAsked = false;
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

  function applyCheats() {
    const hero = session.state.players[0];
    if (dev.opts.god) hero.shield = GOD_SHIELD;
    if (dev.opts.maxPower) {
      hero.range = MAX_RANGE;
      hero.maxCharges = MAX_CHARGES;
      hero.boots = MAX_BOOTS;
    }
  }

  /** Runs one tick with these commands, then its effects, sounds and results. */
  function runTick(cmds: PlayerCommand[]) {
    recorder.before(session.state, cmds);
    view.snapshot(session.state);
    step(session.state, cmds);
    recorder.after(session.state);
    for (const e of session.state.events) {
      if (!session.quiet) view.effect(e, session.state);
      d.onEvent(e);
    }
    matchTally.track(session.state, session.state.events, session.localId);
    if (!session.quiet) audio.events(session.state, session.localId);
    if (session.mode === 'survival') {
      tutorial.tick(session.state);
      story.tick(session.state);
      // Toasts first: a power-up's first pick-up gets its card from story.event, not a toast.
      for (const e of session.state.events) radio.event(e, session.state, (item) => story.powerupSeen(item));
      for (const e of session.state.events) story.event(e);
    }
  }

  function localCommands(): PlayerCommand[] {
    const local = readLocalCommand(keys, touch);
    return session.bot ? [local, session.bot.think(session.state)] : [local];
  }

  return { newGame, clearPresses, runTick, localCommands };
}
