import { MAX_PLAYERS, isPacked, type ClientMsg, type ErrorReason, type ServerMsg } from '../src/net/protocol';

// One online room. Used by both the local dev relay (server/dev_relay.ts) and
// the Cloudflare Worker (server/worker.ts). It knows nothing about the game:
// it seats players, lets the host start rounds and forwards inputs in order.

export interface Peer {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** Most commands one message may carry (half a second). */
const MAX_BATCH = 30;

export class Room {
  private peers = new Map<number, Peer>();
  private host = -1;
  /** Slots in the round being played, or null before the first start. */
  private round: number[] | null = null;
  private lastTick = new Map<number, number>();
  /** Round counter, so late inputs from the previous round are dropped. */
  private r = 0;

  get empty(): boolean {
    return this.peers.size === 0;
  }

  /** Seats a new peer. Returns its slot, or null after sending an error. */
  join(peer: Peer, create: boolean): number | null {
    const fail = (reason: ErrorReason) => {
      peer.send(JSON.stringify({ t: 'error', reason } satisfies ServerMsg));
      peer.close(4000, reason);
      return null;
    };
    if (create && !this.empty) return fail('taken');
    if (!create && this.empty) return fail('not_found');
    if (this.peers.size >= MAX_PLAYERS) return fail('full');
    let slot = 0;
    while (this.peers.has(slot)) slot++;
    this.broadcast({ t: 'joined', slot });
    this.peers.set(slot, peer);
    if (this.host < 0) this.host = slot;
    this.sendTo(slot, { t: 'welcome', you: slot, host: this.host, slots: this.slots(), playing: this.round !== null });
    return slot;
  }

  message(slot: number, raw: string): void {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === 'start') {
      if (slot !== this.host || this.peers.size < 2 || !Number.isInteger(msg.seed)) return;
      this.round = this.slots();
      this.lastTick.clear();
      this.r++;
      this.broadcast({ t: 'start', r: this.r, seed: msg.seed >>> 0, slots: this.round });
    } else if (msg.t === 'in') {
      if (msg.r !== this.r || !this.round?.includes(slot) || !Number.isInteger(msg.tick) || msg.tick < 0) return;
      if (!Array.isArray(msg.c) || msg.c.length === 0 || msg.c.length > MAX_BATCH || !msg.c.every(isPacked)) return;
      this.lastTick.set(slot, Math.max(this.lastTick.get(slot) ?? -1, msg.tick + msg.c.length - 1));
      this.broadcast({ t: 'in', slot, r: this.r, tick: msg.tick, c: msg.c }, slot);
    } else if (msg.t === 'hash') {
      if (msg.r === this.r && Number.isInteger(msg.tick) && Number.isInteger(msg.h)) this.broadcast({ t: 'hash', slot, r: msg.r, tick: msg.tick, h: msg.h }, slot);
    }
  }

  leave(slot: number): void {
    if (!this.peers.delete(slot)) return;
    if (this.host === slot) this.host = this.empty ? -1 : Math.min(...this.peers.keys());
    const lastTick = this.lastTick.get(slot) ?? -1;
    this.lastTick.delete(slot);
    this.broadcast({ t: 'left', slot, host: this.host, lastTick });
    if (this.empty) this.round = null;
  }

  private slots(): number[] {
    return [...this.peers.keys()].sort((a, b) => a - b);
  }

  private sendTo(slot: number, msg: ServerMsg): void {
    try { this.peers.get(slot)?.send(JSON.stringify(msg)); } catch { /* closing */ }
  }

  private broadcast(msg: ServerMsg, except = -1): void {
    for (const slot of this.peers.keys()) if (slot !== except) this.sendTo(slot, msg);
  }
}
