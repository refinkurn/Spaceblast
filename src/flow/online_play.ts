import { hashState } from '../sim/sim';
import { readLocalCommand } from '../input/commands';
import type { KeyboardSource } from '../input/keyboard';
import type { TouchSource } from '../input/touch';
import type { PlayerCommand } from '../sim/command';
import type { Predictor } from '../net/predict';
import type { GameView } from '../view/game_view';
import { t } from '../utils/i18n';
import type { Announcer } from './announcer';
import type { Cinematic } from './cinematic';
import type { Congrats } from './congrats';
import { OnlineRoom, type RoundStart } from './online';
import { OnlineRound, type MatchScore } from './online_match';
import type { Screens } from './screens';
import { fadeThrough } from './transition';
import { session } from './session';

export interface OnlinePlayDeps {
  online: OnlineRoom;
  cine: Cinematic;
  congrats: Congrats;
  score: MatchScore;
  screens: Screens;
  predictor: Predictor;
  announcer: Announcer;
  keys: KeyboardSource;
  touch: TouchSource;
  view: GameView;
  newGame(seed?: number): void;
  runTick(cmds: PlayerCommand[]): void;
  colors(): number[];
  lookOf(s: typeof session.state): number;
  showRoundScore(): void;
}

/** Online rooms: wires the room's callbacks and returns the per-tick and per-frame steps the loop uses. */
export function installOnlinePlay(d: OnlinePlayDeps) {
  const { online, cine, congrats, score, screens, view, announcer } = d;
  const reconnectEl = document.getElementById('reconnect') as HTMLElement;
  const reconnectText = document.getElementById('reconnect-text') as HTMLElement;

  online.onRoundStart = (s: RoundStart) => {
    const resume = s.frames !== undefined;
    const sameRound = resume && session.mode === 'online' && session.net?.r === s.r;
    // Reconnected into a round this browser already finished: nothing to catch up.
    if (sameRound && session.state.status !== 'playing') return;
    // A new round while this browser is a few ticks behind: finish the old one first, so every score agrees.
    if (!resume) while (session.mode === 'online' && session.net && session.state.status === 'playing' && session.net.sync.ready()) onlineStep();
    cine.stop();
    congrats.hide();
    if (!sameRound) score.nextRound(session.mode !== 'online');
    session.mode = 'online';
    session.net = new OnlineRound(s);
    d.predictor.reset();
    session.localId = s.local;
    screens.hideMenu();
    d.newGame(s.seed);
    if (resume) catchUp();
  };
  online.onFrames = (r, tick, c) => session.net?.receive(r, tick, c);
  online.onLeft = () => {
    if (session.mode === 'online' && screens.bannerOpen) d.showRoundScore(); // the host may have changed
  };
  online.onAway = (slot, away) => {
    const name = session.net?.humans.find((p) => p.slot === slot)?.name ?? t('online.aPlayer');
    announcer.flash(away ? t('online.playerAway', { name }) : t('online.playerBack', { name }));
  };
  online.onReconnecting = (on) => {
    reconnectText.textContent = t('online.reconnectingTo', { code: online.code });
    reconnectEl.hidden = !on;
    if (!on) announcer.flash(t('online.reconnected'));
  };
  online.onHash = (r, tick, h) => {
    if (session.net?.otherHash(r, tick, h)) desync(tick);
  };
  online.onExit = (reason) => {
    reconnectEl.hidden = true;
    session.net = null;
    cine.stop();
    congrats.hide();
    if (session.mode === 'online') session.mode = 'battle';
    session.localId = 0;
    if (!reason) fadeThrough(() => {
      d.newGame();
      screens.showMenu();
    });
  };

  /** Runs the next online tick if the server's frame for it has arrived. Returns false while waiting. */
  function onlineStep(): boolean {
    const { net } = session;
    if (!net || session.state.status !== 'playing') return true;
    const cmds = net.commands(session.state);
    if (!cmds) return false;
    d.runTick(cmds);
    const state = session.state;
    if (state.tick % 60 === 0 && !session.quiet) {
      const h = hashState(state);
      online.sendHash(net.r, state.tick, h);
      if (net.ownHash(state.tick, h)) desync(state.tick);
    }
    return true;
  }

  /** Reconnected: replay the round so far at full speed, then show where it stands. */
  function catchUp() {
    session.quiet = true;
    while (session.net && session.state.status === 'playing' && session.net.sync.ready()) onlineStep();
    session.quiet = false;
    view.build(session.state, d.colors(), session.localId, d.lookOf(session.state));
  }

  /** Per frame: aim this browser's command at the server, and watch the connection. */
  function onlineFrame(now: number) {
    const { net, state } = session;
    if (!net) return;
    const sync = net.sync;
    // Aim for a ping spike, not the average: a press that misses its tick is replaced by the last one.
    sync.setRtt(online.rtt + 2 * online.rttSpread);
    if (state.status === 'playing') {
      net.input(readLocalCommand(d.keys, d.touch));
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
    const { net, state } = session;
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

  return { onlineStep, onlineFrame, connectionNote };
}
