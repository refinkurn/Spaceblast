import * as THREE from 'three';
import type { PlayerCommand } from '../sim/command';
import { step } from '../sim/sim';
import type { GameState } from '../sim/state';
import type { GameView } from '../view/game_view';

// The round-end cinematic. Battle rounds are recorded (a state snapshot every
// half second plus every tick's commands), so the last knock-out can be
// replayed in slow motion: the sim is deterministic, re-running the same
// commands from a snapshot gives exactly the same moment. Then the camera
// flies to the winner for a victory dance. Purely visual and local: online
// browsers each play their own copy.

const SNAP_EVERY = 30;
/** The replay starts this long before the knock-out (1.25 s). */
const REPLAY_TICKS = 75;
/** Slow motion: replay ticks per real tick. */
const REPLAY_SPEED = 0.35;
const HOLD_SECONDS = 0.8;
const WINNER_SECONDS = 2.8;

export class Recorder {
  private snaps: GameState[] = [];
  private cmds = new Map<number, PlayerCommand[]>();
  /** The last astronaut knock-out this round. */
  lastDeath: { tick: number; x: number; y: number } | null = null;

  reset(): void {
    this.snaps = [];
    this.cmds.clear();
    this.lastDeath = null;
  }

  /** Call right before step(state, cmds). */
  before(state: GameState, cmds: PlayerCommand[]): void {
    if (state.mode !== 'battle') return;
    if (state.tick % SNAP_EVERY === 0) {
      this.snaps.push(structuredClone(state));
      if (this.snaps.length > 6) this.snaps.shift();
    }
    this.cmds.set(state.tick, cmds.map((c) => ({ ...c })));
    this.cmds.delete(state.tick - 6 * SNAP_EVERY);
  }

  /** Call right after the step. */
  after(state: GameState): void {
    for (const e of state.events) {
      if (e.type === 'player_died') this.lastDeath = { tick: state.tick, x: e.tx * 1000, y: e.ty * 1000 };
    }
  }

  /** A copy of the game as it was at `tick` (re-simulated), or null if not recorded. */
  stateAt(tick: number): GameState | null {
    const snap = [...this.snaps].reverse().find((s) => s.tick <= tick);
    if (!snap) return null;
    const s = structuredClone(snap);
    while (s.tick < tick) {
      const c = this.cmds.get(s.tick);
      if (!c) return null;
      step(s, c);
    }
    return s;
  }

  commandsAt(tick: number): PlayerCommand[] | undefined {
    return this.cmds.get(tick);
  }
}

export interface CinematicInfo {
  winner: number;
  /** Shown above the winner's name, e.g. "Round 2". */
  kicker: string;
  /** e.g. "Ana wins!" or "Draw!" */
  title: string;
  color: number;
  /** Player colours, and this browser's player (for the "you" arrow). */
  colors: number[];
  local: number;
}

type Phase = 'replay' | 'hold' | 'winner';

export class Cinematic {
  private phase: Phase | null = null;
  private replay: GameState | null = null;
  private real!: GameState;
  private info!: CinematicInfo;
  private endTick = 0;
  private acc = 0;
  private t = 0;
  private confetti = 0;
  private done: () => void = () => {};
  private el = document.getElementById('cine') as HTMLElement;
  private tag = document.getElementById('cine-tag') as HTMLElement;

  /** `effects` plays a replayed tick's events (visuals and sound). */
  constructor(private view: GameView, private recorder: Recorder, private effects: (s: GameState) => void) {}

  get active(): boolean {
    return this.phase !== null;
  }

  /** The state to draw while the cinematic runs. */
  get state(): GameState | null {
    return this.phase === null ? null : this.replay ?? this.real;
  }

  start(real: GameState, info: CinematicInfo, done: () => void): void {
    this.real = real;
    this.info = info;
    this.done = done;
    const death = this.recorder.lastDeath;
    const start = death && real.tick - death.tick < 30 ? this.recorder.stateAt(Math.max(0, death.tick - REPLAY_TICKS)) : null;
    if (death && start) {
      this.replay = start;
      this.endTick = death.tick;
      this.acc = 0;
      this.view.build(start, info.colors, -1);
      this.view.rig.focus(this.view.worldOf(death.x, death.y), 0.5);
      this.tag.hidden = false;
      this.phase = 'replay';
    } else {
      this.toWinner();
    }
  }

  /** Tap / Enter: jump to the end. */
  skip(): void {
    if (this.phase) this.finish();
  }

  /** Cancels without calling `done` (a new round started). */
  stop(): void {
    if (!this.phase) return;
    this.phase = null;
    this.replay = null;
    this.hideOverlay();
    this.view.heroes.forEach((h) => h.celebrate(false));
    this.view.rig.reset();
  }

  /** Advances the cinematic; returns the interpolation alpha for drawing. */
  update(dt: number): number {
    if (this.phase === 'replay' && this.replay) {
      this.acc += dt * 60 * REPLAY_SPEED;
      while (this.acc >= 1 && this.replay.tick < this.endTick) {
        const c = this.recorder.commandsAt(this.replay.tick);
        if (!c) break;
        this.view.snapshot(this.replay);
        step(this.replay, c);
        this.effects(this.replay);
        this.acc -= 1;
      }
      if (this.replay.tick >= this.endTick) {
        this.phase = 'hold';
        this.t = 0;
      }
      return Math.min(1, this.acc);
    }
    this.t += dt;
    if (this.phase === 'hold' && this.t >= HOLD_SECONDS) this.toWinner();
    else if (this.phase === 'winner') {
      this.confetti -= dt;
      const w = this.real.players[this.info.winner];
      if (w && this.confetti <= 0) {
        this.confetti = 0.25;
        this.view.debris.burst(Math.round(w.x / 1000), Math.round(w.y / 1000), this.info.color, 10);
      }
      if (this.t >= WINNER_SECONDS) this.finish();
    }
    return 1;
  }

  private toWinner(): void {
    this.replay = null;
    this.tag.hidden = true;
    this.view.build(this.real, this.info.colors, this.info.local);
    const w = this.real.players[this.info.winner];
    if (w) {
      // Aim a little below the winner so they stand above the title.
      this.view.rig.focus(this.view.worldOf(w.x, w.y).add(new THREE.Vector3(0, 0, 1.3)), 0.42);
      this.view.heroes[this.info.winner].celebrate(true);
    } else {
      this.view.rig.focus(null);
    }
    (this.el.querySelector('.cine-kicker') as HTMLElement).textContent = this.info.kicker;
    const title = this.el.querySelector('.cine-title') as HTMLElement;
    title.textContent = this.info.title;
    title.style.color = `#${this.info.color.toString(16).padStart(6, '0')}`;
    this.el.hidden = false;
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
    this.phase = 'winner';
    this.t = 0;
    this.confetti = 0;
  }

  private finish(): void {
    if (this.phase !== 'winner') this.toWinner();
    this.phase = null;
    this.hideOverlay();
    this.view.heroes.forEach((h) => h.celebrate(false));
    this.view.rig.focus(null);
    this.done();
  }

  private hideOverlay(): void {
    this.el.hidden = true;
    this.tag.hidden = true;
  }
}
