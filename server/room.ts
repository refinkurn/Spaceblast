import {
  AWAY_MS, CLOSE_AWAY, DEFAULT_SETTINGS, MAX_PLAYERS, PLAYER_COLORS, cleanName, cleanSettings, isPacked,
  type ClientMsg, type ErrorReason, type Profile, type RoomSettings, type ServerMsg,
} from '../src/net/protocol';

// One online room. Used by both the local dev relay (server/dev_relay.ts) and
// the Cloudflare Worker (server/worker.ts). It knows nothing about the game:
// it seats players (name + colour), keeps the host's settings, lets the host
// start rounds and forwards inputs in order.

export interface Peer {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** Name and colour wishes from the join URL. */
export interface JoinWish {
  name?: string | null;
  color?: number | null;
}

/** Reads ?name=..&color=.. from a join URL. */
export function wishFromUrl(url: URL): JoinWish {
  const color = url.searchParams.get('color');
  return { name: url.searchParams.get('name'), color: color === null ? null : Number(color) };
}

/** Most commands one message may carry (half a second). */
const MAX_BATCH = 30;

export class Room {
  private peers = new Map<number, Peer>();
  private profiles = new Map<number, Profile>();
  private settings: RoomSettings = { ...DEFAULT_SETTINGS };
  private host = -1;
  /** Slots in the round being played, or null before the first start. */
  private round: number[] | null = null;
  private lastTick = new Map<number, number>();
  /** Round counter, so late inputs from the previous round are dropped. */
  private r = 0;
  /** When each player last showed their game was running. */
  private seen = new Map<number, number>();

  get empty(): boolean {
    return this.peers.size === 0;
  }

  /** Seats a new peer. Returns its slot, or null after sending an error. */
  join(peer: Peer, create: boolean, wish: JoinWish = {}): number | null {
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
    const player: Profile = { slot, name: cleanName(wish.name, slot), color: this.freeColor(wish.color ?? -1) };
    this.broadcast({ t: 'profile', player });
    this.peers.set(slot, peer);
    this.profiles.set(slot, player);
    if (this.host < 0) this.host = slot;
    this.clampBots();
    this.sendTo(slot, {
      t: 'welcome', you: slot, host: this.host, players: this.players(), settings: this.settings, playing: this.round !== null,
    });
    return slot;
  }

  message(slot: number, raw: string, now = Date.now()): void {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === 'alive' || msg.t === 'in') {
      this.seen.set(slot, now);
      this.dropAway(now);
    }
    if (msg.t === 'start') {
      if (slot !== this.host || !Number.isInteger(msg.seed)) return;
      this.settings = cleanSettings(this.settings, this.peers.size);
      // Alone is fine with bots; otherwise it takes two.
      if (this.peers.size + this.settings.bots < 2) return;
      this.round = this.slots();
      this.lastTick.clear();
      this.r++;
      this.seen.clear();
      for (const s of this.round) this.seen.set(s, now);
      this.broadcast({ t: 'start', r: this.r, seed: msg.seed >>> 0, players: this.players(), settings: this.settings });
    } else if (msg.t === 'profile') {
      const me = this.profiles.get(slot);
      if (!me) return;
      const color = Number.isInteger(msg.color) && this.colorFree(msg.color, slot) ? msg.color : me.color;
      const player = { slot, name: cleanName(msg.name, slot), color };
      this.profiles.set(slot, player);
      this.broadcast({ t: 'profile', player });
    } else if (msg.t === 'settings') {
      if (slot !== this.host) return;
      this.settings = cleanSettings(msg.s, this.peers.size);
      this.broadcast({ t: 'settings', s: this.settings });
    } else if (msg.t === 'in') {
      if (msg.r !== this.r || !this.round?.includes(slot) || !Number.isInteger(msg.tick) || msg.tick < 0) return;
      if (!Array.isArray(msg.c) || msg.c.length === 0 || msg.c.length > MAX_BATCH || !msg.c.every(isPacked)) return;
      this.lastTick.set(slot, Math.max(this.lastTick.get(slot) ?? -1, msg.tick + msg.c.length - 1));
      this.broadcast({ t: 'in', slot, r: this.r, tick: msg.tick, c: msg.c }, slot);
    } else if (msg.t === 'hash') {
      if (msg.r === this.r && Number.isInteger(msg.tick) && Number.isInteger(msg.h)) this.broadcast({ t: 'hash', slot, r: msg.r, tick: msg.tick, h: msg.h }, slot);
    }
  }

  /**
   * A phone that leaves the app stops sending, which freezes the round for
   * everyone (lockstep waits for its input). Drop a player who has been silent
   * for AWAY_MS while someone else is still playing.
   */
  private dropAway(now: number): void {
    if (!this.round) return;
    for (const slot of this.round) {
      const peer = this.peers.get(slot);
      const last = this.seen.get(slot);
      if (!peer || last === undefined || now - last < AWAY_MS) continue;
      peer.close(CLOSE_AWAY, 'away');
      this.leave(slot);
    }
  }

  leave(slot: number): void {
    if (!this.peers.delete(slot)) return;
    this.profiles.delete(slot);
    this.seen.delete(slot);
    if (this.host === slot) this.host = this.empty ? -1 : Math.min(...this.peers.keys());
    const lastTick = this.lastTick.get(slot) ?? -1;
    this.lastTick.delete(slot);
    this.broadcast({ t: 'left', slot, host: this.host, lastTick });
    if (this.empty) this.round = null;
  }

  /** A newcomer may push the total over 4: the host's bot count shrinks to fit. */
  private clampBots(): void {
    const s = cleanSettings(this.settings, this.peers.size);
    if (s.bots === this.settings.bots) return;
    this.settings = s;
    this.broadcast({ t: 'settings', s });
  }

  private colorFree(color: number, slot: number): boolean {
    return color >= 0 && color < PLAYER_COLORS.length && ![...this.profiles.values()].some((p) => p.slot !== slot && p.color === color);
  }

  /** The wished colour if nobody has it, else the first free one. */
  private freeColor(wish: number): number {
    if (this.colorFree(wish, -1)) return wish;
    let c = 0;
    while (!this.colorFree(c, -1)) c++;
    return c;
  }

  private slots(): number[] {
    return [...this.peers.keys()].sort((a, b) => a - b);
  }

  private players(): Profile[] {
    return this.slots().map((s) => this.profiles.get(s)!);
  }

  private sendTo(slot: number, msg: ServerMsg): void {
    try { this.peers.get(slot)?.send(JSON.stringify(msg)); } catch { /* closing */ }
  }

  private broadcast(msg: ServerMsg, except = -1): void {
    for (const slot of this.peers.keys()) if (slot !== except) this.sendTo(slot, msg);
  }
}
