import { NO_COMMAND, type PlayerCommand } from '../sim/command';
import { packCommand, unpackCommand } from './protocol';

// Deterministic lockstep: every browser runs the same sim and only shares
// inputs. A local input is used INPUT_DELAY ticks after it is read, which gives
// it time to reach the others; a tick only runs once every player's input for
// it has arrived, so all browsers step through exactly the same commands.

/** 6 ticks = 100 ms: covers a typical relay round trip without feeling laggy. */
export const INPUT_DELAY = 6;
/** Inputs are sent in pairs (30 messages a second) to keep server costs down. */
export const SEND_EVERY = 2;

const LEAVE: PlayerCommand = Object.freeze({ ...NO_COMMAND, leave: true });

export class Lockstep {
  /** Index of the next tick to run (0 = the round's first step). */
  tick = 0;
  /** inputs[player][tick] = packed command. */
  private inputs: number[][];
  /** Last tick each player has input for before leaving (Infinity while present). */
  private leftAfter: number[];
  private outbox: number[] = [];
  private outStart: number;

  constructor(readonly players: number, readonly local: number, readonly delay = INPUT_DELAY) {
    // Nobody can have input for the first `delay` ticks: everyone starts idle.
    this.inputs = Array.from({ length: players }, () => Array<number>(delay).fill(0));
    this.leftAfter = Array<number>(players).fill(Infinity);
    this.outStart = delay;
  }

  /** Inputs from the network for `player`, starting at `tick`. */
  receive(player: number, tick: number, packed: readonly number[]): void {
    if (player === this.local || player < 0 || player >= this.players) return;
    packed.forEach((c, i) => (this.inputs[player][tick + i] = c));
  }

  /** `player` left; ticks after `lastTick` have no input from them. */
  playerLeft(player: number, lastTick: number): void {
    if (player === this.local || player < 0 || player >= this.players) return;
    this.leftAfter[player] = Math.max(lastTick, this.delay - 1);
  }

  /** Has every player's input for the next tick arrived? */
  ready(): boolean {
    const t = this.tick;
    return this.inputs.every((list, p) => t > this.leftAfter[p] || list[t] !== undefined);
  }

  /**
   * Records the local input (it runs `delay` ticks from now) and returns the
   * commands for the next tick. Only call when ready().
   */
  advance(local: PlayerCommand): PlayerCommand[] {
    const packed = packCommand(local);
    this.inputs[this.local][this.tick + this.delay] = packed;
    this.outbox.push(packed);
    const t = this.tick++;
    return this.inputs.map((list, p) => (t > this.leftAfter[p] ? LEAVE : unpackCommand(list[t])));
  }

  /** Local inputs waiting to be sent, or null until a batch is full (or `force`). */
  takeOutgoing(force = false): { tick: number; c: number[] } | null {
    if (this.outbox.length === 0 || (!force && this.outbox.length < SEND_EVERY)) return null;
    const out = { tick: this.outStart, c: this.outbox };
    this.outStart += this.outbox.length;
    this.outbox = [];
    return out;
  }
}
