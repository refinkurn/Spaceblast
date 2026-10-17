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

export class FrameSync {
  /** Next tick to simulate. */
  tick = 0;
  /** Newest tick received from the server, -1 before the first. */
  latest = -1;
  /** performance.now() of the last frame received. */
  lastFrameAt = 0;
  /** Ticks ahead of `latest` that this browser's commands are aimed at. */
  delay = 6;
  private frames: number[][] = [];
  private lastTarget = -1;
  private queuedPlace = false;
  private outbox: number[] = [];
  private outStart = 0;

  constructor(readonly players: number) {}

  /** Frames from the server for ticks `tick`, `tick + 1`, ... */
  receive(tick: number, c: readonly (readonly number[])[], now = performance.now()): void {
    if (!Number.isInteger(tick) || tick < 0 || tick > this.latest + 1 + 36000) return;
    c.forEach((row, i) => {
      if (Array.isArray(row) && row.length === this.players && row.every((v) => v === FRAME_LEFT || isPacked(v))) {
        this.frames[tick + i] = row as number[];
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

  /** Every player's command for the next tick. Only call when ready(). */
  next(): PlayerCommand[] {
    const row = this.frames[this.tick++];
    return row.map((v) => (v === FRAME_LEFT ? LEAVE : unpackCommand(v)));
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
      this.outbox.push(packCommand({ ...cmd, place: this.queuedPlace }));
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
