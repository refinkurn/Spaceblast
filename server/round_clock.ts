import { FRAME_LEFT, isPacked, type ClientMsg, type Profile, type RoomSettings } from '../src/net/protocol';

// One round's clock, for server/room.ts: 60 times a second the room sends every
// player's command for the next tick. A command that arrives late doesn't hold
// anyone up: that player keeps doing what they did (without placing again), so
// a slow connection only hurts its owner. Every tick sent is kept, so a player
// who reconnects can replay the round so far.

export const TICK_MS = 1000 / 60;
/** Most commands one message may carry (half a second). */
const MAX_BATCH = 30;
/** Inputs may be sent at most this far ahead of the clock (10 s). */
const MAX_AHEAD = 600;
/** A round's clock stops this long after its time and collapse could possibly last. */
const ROUND_SLACK_MS = 90000;
/**
 * Every browser ends a round on the same tick, so they all say 'over' within a
 * moment of each other. One that still hasn't this long after the first (a
 * phone with its screen off) no longer keeps the host from starting the next round.
 */
export const STRAGGLER_MS = 10000;

/** Is this seat's player connected right now? */
export type Connected = (slot: number) => boolean;

export class RoundClock {
  /** Ticks already sent; inputs for earlier ticks are too late. */
  sent = 0;
  /** Every tick's commands so far (for reconnecting players). */
  readonly frames: number[][] = [];
  /** Seats whose browser said this round is over. */
  readonly over = new Set<number>();
  active = true;
  private readonly endBy: number;
  /** When the first 'over' arrived (-1: none yet). */
  private firstOverAt = -1;
  private readonly pending: Map<number, number>[];
  private readonly last: number[];
  private readonly left: boolean[];

  constructor(
    readonly r: number,
    readonly seed: number,
    /** Sim player i is players[i]. */
    readonly players: Profile[],
    readonly settings: RoomSettings,
    readonly startAt: number,
  ) {
    const n = players.length;
    this.pending = Array.from({ length: n }, () => new Map());
    this.last = Array(n).fill(0);
    this.left = Array(n).fill(false);
    this.endBy = startAt + settings.time * 1000 + ROUND_SLACK_MS;
  }

  /** The seats playing this round (left or not). */
  get slots(): number[] {
    return this.players.map((p) => p.slot);
  }

  /** True when the seat plays this round and hasn't left it for good. */
  plays(slot: number): boolean {
    const i = this.players.findIndex((p) => p.slot === slot);
    return i >= 0 && !this.left[i];
  }

  /** May the host start a new round now? Not while this one runs, unless only stragglers are left. */
  canRestart(now: number): boolean {
    return !this.active || (this.firstOverAt >= 0 && now - this.firstOverAt >= STRAGGLER_MS);
  }

  /** The seat's player is out for good: from the next tick on they are FRAME_LEFT. */
  leave(slot: number): void {
    const i = this.players.findIndex((p) => p.slot === slot);
    if (i < 0) return;
    this.left[i] = true;
    this.pending[i].clear();
  }

  /** The seat's browser finished the round; the clock stops once everyone still connected has. */
  finish(slot: number, now: number, connected: Connected): void {
    if (this.firstOverAt < 0) this.firstOverAt = now;
    this.over.add(slot);
    this.checkOver(connected);
  }

  /** Everyone still connected has finished the round: stop the clock. */
  checkOver(connected: Connected): void {
    if (!this.active || this.over.size === 0) return;
    const still = this.players.filter((p, i) => !this.left[i] && connected(p.slot));
    if (still.length > 0 && still.every((p) => this.over.has(p.slot))) this.active = false;
  }

  /** A player's packed commands for ticks msg.tick, msg.tick + 1, ... Bad or too late ones are dropped. */
  input(slot: number, msg: Extract<ClientMsg, { t: 'in' }>): void {
    if (!this.active || msg.r !== this.r) return;
    const i = this.players.findIndex((p) => p.slot === slot);
    if (i < 0 || this.left[i]) return;
    if (!Number.isInteger(msg.tick) || !Array.isArray(msg.c) || msg.c.length === 0 || msg.c.length > MAX_BATCH) return;
    if (!msg.c.every(isPacked) || msg.tick > this.sent + MAX_AHEAD) return;
    // Ticks already sent are too late; the rest wait for their turn.
    msg.c.forEach((c, k) => {
      if (msg.tick + k >= this.sent) this.pending[i].set(msg.tick + k, c);
    });
  }

  /**
   * The ticks due by `now` (from tick `tick` on), recorded as sent; null when
   * none are due. Past the longest a round can last, the clock stops instead.
   */
  due(now: number, connected: Connected): { tick: number; c: number[][] } | null {
    if (!this.active) return null;
    if (now > this.endBy) {
      this.active = false;
      return null;
    }
    const due = Math.floor((now - this.startAt) / TICK_MS);
    if (due <= this.sent) return null;
    const tick = this.sent;
    const c: number[][] = [];
    for (let t = tick; t < due; t++) c.push(this.frame(t, connected));
    this.sent = due;
    this.frames.push(...c);
    return { tick, c };
  }

  /** Everyone's command for tick t. */
  private frame(t: number, connected: Connected): number[] {
    return this.players.map((p, i) => {
      if (this.left[i]) return FRAME_LEFT;
      const pending = this.pending[i];
      const mine = pending.get(t);
      // Ticks are framed in order and inputs only land on ticks not yet framed,
      // so t is the only key that can be due: no need to scan the whole map.
      pending.delete(t);
      if (mine !== undefined) {
        this.last[i] = mine;
        return mine;
      }
      // Late or missing: keep moving the same way, but never place again by accident.
      if (!connected(p.slot)) return 0;
      return this.last[i] & ~64;
    });
  }
}
