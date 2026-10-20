import { NetClient } from './client';
import { CLOSE_AWAY, CLOSE_FLOOD, CLOSE_RETRY, REJOIN_MS, type ClientMsg, type ServerMsg } from './protocol';

// The connection to a room, kept alive: it measures the ping, and when the
// connection drops it reconnects to the same seat (the server keeps it for
// REJOIN_MS) without bothering the other players. The seat is remembered for
// this tab too, so a page reload can rejoin.

const SESSION_KEY = 'spaceblast.seat';
const PING_EVERY_MS = 1000;
const RETRY_EVERY_MS = 1500;

export interface Seat {
  code: string;
  slot: number;
  token: string;
  /** Date.now() when the seat was last confirmed. */
  at: number;
}

/** A seat from earlier in this tab that may still be waiting (e.g. after a reload). */
export function savedSeat(): Seat | null {
  try {
    const seat = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Seat | null;
    return seat && Date.now() - seat.at < REJOIN_MS - 2000 ? seat : null;
  } catch {
    return null;
  }
}

export class RoomLink {
  onMessage: (m: ServerMsg) => void = () => {};
  /** Reconnecting started (true) or finished (false). */
  onReconnecting: (on: boolean) => void = () => {};
  /** The seat is gone for good, with a message for the player. */
  onLost: (reason: string) => void = () => {};
  /** Smoothed round-trip time in ms. */
  rtt = 100;
  /** Smoothed deviation of the round-trip time (ms): how much the ping wobbles. */
  rttSpread = 20;
  reconnecting = false;
  private net = new NetClient();
  private seat: Seat | null = null;
  private pingTimer = 0;
  private pingId = 0;
  private pingSent = new Map<number, number>();
  private retryUntil = 0;
  private retryTimer = 0;

  constructor() {
    this.net.onMessage = (m) => this.handle(m);
    this.net.onDrop = (code) => this.dropped(code);
  }

  get open(): boolean {
    return this.net.open;
  }

  /** Connects to a room (new seat). Resolves with the first message (welcome or error). */
  async connect(code: string, create: boolean, name: string, color: number): Promise<ServerMsg> {
    this.stopRetry();
    this.seat = null;
    const first = await this.net.connect(code, create, name, color);
    if (first.t === 'welcome') this.keepSeat(code, first.you, first.token);
    return first;
  }

  /** Back into a seat from earlier (after a page reload). */
  async rejoin(seat: Seat): Promise<ServerMsg> {
    this.seat = seat;
    return this.net.connect(seat.code, false, '', -1, { slot: seat.slot, token: seat.token });
  }

  send(msg: ClientMsg): void {
    this.net.send(msg);
  }

  /** Leaves the room for good. */
  leave(): void {
    this.stopRetry();
    this.seat = null;
    this.forget();
    window.clearInterval(this.pingTimer);
    this.net.close();
  }

  /** The connection looks stuck (no frames for a while): drop it and reconnect now. */
  retryNow(): void {
    if (!this.seat || this.reconnecting) return;
    this.net.close(CLOSE_RETRY);
    this.dropped(CLOSE_RETRY);
  }

  private handle(m: ServerMsg): void {
    if (m.t === 'pong') {
      const sent = this.pingSent.get(m.id);
      this.pingSent.delete(m.id);
      if (sent !== undefined) {
        const sample = performance.now() - sent;
        this.rttSpread = this.rttSpread * 0.75 + Math.abs(sample - this.rtt) * 0.25;
        this.rtt = this.rtt * 0.7 + sample * 0.3;
      }
      return;
    }
    if (m.t === 'welcome') {
      if (this.seat) this.keepSeat(this.seat.code, m.you, m.token);
      if (this.reconnecting) {
        this.reconnecting = false;
        this.stopRetry();
        this.onReconnecting(false);
      }
    }
    if (m.t === 'error' && m.reason === 'expired' && this.reconnecting) {
      this.giveUp('You were gone too long, so you left the room.');
      return;
    }
    this.onMessage(m);
  }

  private keepSeat(code: string, slot: number, token: string): void {
    this.seat = { code, slot, token, at: Date.now() };
    this.remember();
    window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => this.ping(), PING_EVERY_MS);
  }

  private ping(): void {
    if (!this.net.open) return;
    const id = ++this.pingId;
    this.pingSent.set(id, performance.now());
    if (this.pingSent.size > 10) this.pingSent.delete(this.pingSent.keys().next().value!);
    this.net.send({ t: 'ping', id });
    this.remember(); // keeps the reload-rejoin seat fresh
  }

  /** The connection closed without us asking. */
  private dropped(code: number): void {
    window.clearInterval(this.pingTimer);
    // No seat: a refused join (its error was already shown) or we already gave up.
    if (!this.seat) return;
    if (code === CLOSE_AWAY) return this.giveUp('You were away from the game too long, so you left the room.');
    if (code === CLOSE_FLOOD) return this.giveUp('Connection to the room was lost.');
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.retryUntil = performance.now() + REJOIN_MS - 1000;
    this.onReconnecting(true);
    this.attempt();
  }

  private attempt(): void {
    if (!this.reconnecting || !this.seat) return;
    if (performance.now() > this.retryUntil) {
      this.giveUp('Could not reconnect to the room.');
      return;
    }
    this.net.connect(this.seat.code, false, '', -1, { slot: this.seat.slot, token: this.seat.token })
      .catch(() => { /* no network yet: try again shortly */ });
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => {
      if (this.reconnecting && !this.net.open) this.attempt();
    }, RETRY_EVERY_MS);
  }

  private giveUp(reason: string): void {
    this.stopRetry();
    this.reconnecting = false;
    this.seat = null;
    this.forget();
    this.onLost(reason);
  }

  private stopRetry(): void {
    window.clearTimeout(this.retryTimer);
  }

  private remember(): void {
    if (!this.seat) return;
    this.seat.at = Date.now();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.seat)); } catch { /* private mode */ }
  }

  private forget(): void {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
  }
}
