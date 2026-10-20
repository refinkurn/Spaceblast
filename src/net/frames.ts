import { NO_COMMAND, type PlayerCommand } from '../sim/command';
import { FRAME_LEFT, isPacked, packCommand, unpackCommand } from './protocol';

// Online rounds run on the room server's clock. The server sends every
// player's command for each tick; this browser plays those ticks in order, so
// every browser runs exactly the same game. Its own commands are aimed a few
// ticks ahead of the newest tick it has seen, far enough to reach the server
// in time on its own connection. A slow connection only delays its owner:
// nobody else ever waits for it.

const LEAVE: PlayerCommand = Object.freeze({ ...NO_COMMAND, leave: true });
const TICK_MS = 1000 / 60;
/**
 * Input delay bounds in ticks (50 ms to 1 s). A command must reach the server
 * before its tick is sent, so the delay has to cover this browser's whole ping;
 * past 1 s the connection is too slow to play.
 */
const MIN_DELAY = 3;
const MAX_DELAY = 60;
/**
 * Jitter buffer bounds in ticks. Frames arrive in uneven bursts even on a good
 * connection; playing each one the moment it lands makes the game freeze and
 * then race. Keeping a few ticks in reserve (sized to the recent jitter) lets
 * the game play at an even 60 Hz instead.
 */
const MIN_RESERVE = 1;
const MAX_RESERVE = 6;
/** Behind by more than this (a lag spike, a hidden tab): catch up fast. */
export const FAR_BEHIND = 30;

export class FrameSync {
  /** Next tick to simulate. */
  tick = 0;
  /** Newest tick received from the server, -1 before the first. */
  latest = -1;
  /** performance.now() of the last frame received. */
  lastFrameAt = 0;
  /** Ticks ahead of `latest` that this browser's commands are aimed at. */
  delay = 6;
  /** Recent worst lateness of a frame message (ms), decaying over a few seconds. */
  jitter = TICK_MS;
  private frames: number[][] = [];
  /** This browser's own packed commands by tick, until the server's frame for that tick arrives (for prediction). */
  private mine = new Map<number, number>();
  private lastTarget = -1;
  private queuedPlace = false;
  private outbox: number[] = [];
  private outStart = 0;

  constructor(readonly players: number) {}

  /** Frames from the server for ticks `tick`, `tick + 1`, ... */
  receive(tick: number, c: readonly (readonly number[])[], now = performance.now()): void {
    if (!Number.isInteger(tick) || tick < 0 || tick > this.latest + 1 + 36000) return;
    // Lateness = gap since the last message minus the time its ticks cover.
    // A huge batch (a reconnect replay) says nothing about jitter.
    if (this.lastFrameAt > 0 && c.length <= MAX_DELAY) {
      const late = Math.max(0, now - this.lastFrameAt - (c.length - 1) * TICK_MS);
      this.jitter = Math.max(late, this.jitter * 0.99);
    }
    c.forEach((row, i) => {
      if (Array.isArray(row) && row.length === this.players && row.every((v) => v === FRAME_LEFT || isPacked(v))) {
        this.frames[tick + i] = row as number[];
        this.mine.delete(tick + i);
        this.latest = Math.max(this.latest, tick + i);
      }
    });
    this.lastFrameAt = now;
  }

  /** Frames received but not yet played. */
  get buffered(): number {
    return this.latest - this.tick + 1;
  }

  ready(): boolean {
    return this.frames[this.tick] !== undefined;
  }

  /** Ticks kept in reserve against jitter. */
  get reserve(): number {
    return Math.max(MIN_RESERVE, Math.min(MAX_RESERVE, Math.ceil(this.jitter / TICK_MS)));
  }

  /**
   * How many ticks to play this display frame, given `due` ticks of real time
   * have passed. Plays at an even pace while the reserve holds, waits when it
   * runs low, and drifts back towards it (one extra tick, or a fast catch-up
   * when far behind) instead of lurching.
   */
  pace(due: number): number {
    const spare = this.buffered - this.reserve;
    if (spare <= 0) return 0;
    if (this.buffered > FAR_BEHIND) return Math.min(spare, due + 12);
    if (spare > 3) return Math.min(spare, due + 1);
    return Math.min(spare, due);
  }

  /** Every player's command for the next tick. Only call when ready(). */
  next(): PlayerCommand[] {
    this.mine.delete(this.tick);
    const row = this.frames[this.tick++];
    return row.map((v) => (v === FRAME_LEFT ? LEAVE : unpackCommand(v)));
  }

  /** The last tick this browser has a command for (its newest press). */
  get aim(): number {
    return this.lastTarget;
  }

  /**
   * A best guess at everyone's command for tick t, for prediction only: the
   * server's frame if it has arrived; otherwise this browser's own command for
   * that tick, and for the others what they did last (without placing again,
   * as the server would).
   */
  guess(t: number, local: number): PlayerCommand[] {
    const row = this.frames[t];
    if (row) return row.map((v) => (v === FRAME_LEFT ? LEAVE : unpackCommand(v)));
    const base = this.frames[this.latest];
    return Array.from({ length: this.players }, (_, i) => {
      const last = base?.[i] ?? 0;
      if (last === FRAME_LEFT) return LEAVE;
      if (i === local) return unpackCommand(this.mine.get(t) ?? last & ~64);
      return unpackCommand(last & ~64);
    });
  }

  /** Round-trip time to the server: commands are aimed just far enough ahead to arrive in time. */
  setRtt(ms: number): void {
    this.delay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, Math.ceil(ms / TICK_MS) + 3));
  }

  /**
   * This browser's command right now. It covers every tick from the last one
   * sent up to `latest + delay`; a charge press goes on the first of them only.
   */
  input(cmd: PlayerCommand): void {
    const target = this.latest + this.delay;
    if (cmd.place) this.queuedPlace = true;
    if (target <= this.lastTarget) return;
    const from = Math.max(this.lastTarget + 1, this.latest + 1);
    if (this.outbox.length === 0) this.outStart = from;
    else if (from !== this.outStart + this.outbox.length) {
      // A gap (we were far behind): start a new batch from here.
      this.outbox = [];
      this.outStart = from;
    }
    for (let t = from; t <= target; t++) {
      const packed = packCommand({ ...cmd, place: this.queuedPlace });
      this.outbox.push(packed);
      this.mine.set(t, packed);
      this.queuedPlace = false;
    }
    this.lastTarget = target;
  }

  /** Commands waiting to be sent (one message), or null until at least `min` are waiting. */
  takeOutgoing(min = 1): { tick: number; c: number[] } | null {
    if (this.outbox.length < Math.max(1, min)) return null;
    const out = { tick: this.outStart, c: this.outbox.slice(0, 30) };
    this.outbox = this.outbox.slice(30);
    this.outStart += out.c.length;
    return out;
  }
}
