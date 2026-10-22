import {
  CLOSE_AWAY, CLOSE_FLOOD, CLOSE_LEAVE, CLOSE_RETRY, DEFAULT_SETTINGS, FRAME_LEFT, MAX_PLAYERS, PLAYER_COLORS, REJOIN_MS, cleanName, cleanSettings, isPacked,
  type ClientMsg, type ErrorReason, type Profile, type RoomSettings, type ServerMsg,
} from '../src/net/protocol';

// One online room. Used by both the local dev relay (server/dev_relay.ts) and
// the Cloudflare Worker (server/worker.ts). It knows nothing about the game
// rules: it seats players (name + colour), keeps the host's settings, starts
// rounds, and runs the round clock.
//
// The clock: 60 times a second the room sends every player's command for the
// next tick. A command that arrives late doesn't hold anyone up: that player
// keeps doing what they did (without placing again), so a slow connection only
// hurts its owner. A dropped player may reconnect within REJOIN_MS and gets
// the round so far to catch up; after that they are out for the round.

export interface Peer {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** What a browser asks for in its join URL. */
export interface JoinRequest {
  create: boolean;
  name?: string | null;
  color?: number | null;
  /** Reconnecting: the seat and the token from its welcome. */
  rejoin?: number | null;
  token?: string | null;
}

/** Reads ?create, ?name, ?color, ?rejoin and ?token from a join URL. */
export function requestFromUrl(url: URL): JoinRequest {
  const num = (k: string) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) : null);
  return {
    create: url.searchParams.has('create'),
    name: url.searchParams.get('name'),
    color: num('color'),
    rejoin: num('rejoin'),
    token: url.searchParams.get('token'),
  };
}

export const TICK_MS = 1000 / 60;
/** Most commands one message may carry (half a second). */
const MAX_BATCH = 30;
/** Inputs may be sent at most this far ahead of the clock (10 s). */
const MAX_AHEAD = 600;
/** Biggest message a browser ever needs to send. */
const MAX_MESSAGE = 2048;
/** A connected browser that sends nothing for this long is gone (it pings every second). */
const SILENT_MS = 30000;
/** A round's clock stops this long after its time and collapse could possibly last. */
const ROUND_SLACK_MS = 90000;
/**
 * Flood guard: a browser sends ~32 messages a second (inputs, ping, hash).
 * Each peer gets a bucket of BURST messages refilled at RATE per second; one
 * that empties it is disconnected, so a broken or cheating client can't run up
 * the server bill or swamp the others.
 */
const RATE = 90;
const BURST = 150;

interface Seat {
  peer: Peer | null;
  profile: Profile;
  token: string;
  /** When the connection dropped (seat kept for REJOIN_MS). */
  droppedAt: number;
  /** The connection that dropped: its late deliberate close (after an error) still frees the seat. */
  dropped: Peer | null;
  lastMsg: number;
  bucket: { tokens: number; at: number };
}

interface Round {
  r: number;
  seed: number;
  players: Profile[];
  settings: RoomSettings;
  startAt: number;
  /** Ticks already sent; inputs for earlier ticks are too late. */
  sent: number;
  /** Every tick's commands so far (for reconnecting players). */
  frames: number[][];
  pending: Map<number, number>[];
  last: number[];
  left: boolean[];
  over: Set<number>;
  active: boolean;
  endBy: number;
}

function newToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Closes a connection that may already be dead (closing one can throw): the seat bookkeeping after it must still run. */
function hangUp(peer: Peer, code: number, reason: string): void {
  try { peer.close(code, reason); } catch { /* already gone */ }
}

export class Room {
  private seats = new Map<number, Seat>();
  private settings: RoomSettings = { ...DEFAULT_SETTINGS };
  private host = -1;
  private round: Round | null = null;
  private r = 0;
  /** Where this room runs (a Cloudflare data centre code like "SIN"), shown in the stats overlay. */
  where = '';

  get empty(): boolean {
    return this.seats.size === 0;
  }

  /** True while the room needs pump() calls (a round clock or a seat waiting for its player). */
  get busy(): boolean {
    if (this.round?.active) return true;
    for (const s of this.seats.values()) if (!s.peer) return true;
    return false;
  }

  /** Seats a peer (new or reconnecting). Returns its slot, or null after sending an error. */
  connect(peer: Peer, req: JoinRequest, now = Date.now()): number | null {
    const fail = (reason: ErrorReason) => {
      peer.send(JSON.stringify({ t: 'error', reason } satisfies ServerMsg));
      peer.close(4000, reason);
      return null;
    };
    if (req.rejoin !== null && req.rejoin !== undefined) {
      const seat = this.seats.get(req.rejoin);
      if (!seat || seat.token !== req.token) return fail('expired');
      // The old connection may still look open (a phone that lost Wi-Fi often
      // never closes it): the token proves it's the same player, so swap it out.
      if (seat.peer) {
        const old = seat.peer;
        seat.peer = null;
        hangUp(old, CLOSE_RETRY, 'replaced');
      }
      return this.reattach(req.rejoin, seat, peer, now);
    }
    if (req.create && !this.empty) return fail('taken');
    if (!req.create && this.empty) return fail('not_found');
    if (this.seats.size >= MAX_PLAYERS) return fail('full');
    let slot = 0;
    while (this.seats.has(slot)) slot++;
    const profile: Profile = { slot, name: cleanName(req.name, slot), color: this.freeColor(req.color ?? -1) };
    this.broadcast({ t: 'profile', player: profile });
    this.seats.set(slot, { peer, profile, token: newToken(), droppedAt: 0, dropped: null, lastMsg: now, bucket: { tokens: BURST, at: now } });
    if (this.host < 0) this.host = slot;
    this.clampBots();
    this.welcome(slot);
    return slot;
  }

  /**
   * The peer's connection closed (or errored). A deliberate leave frees the seat;
   * a drop keeps it for REJOIN_MS. A leave that comes after the same connection
   * was already counted as a drop (an error event, then the close) still frees it.
   */
  closed(slot: number, peer: Peer, code: number, now = Date.now()): void {
    const seat = this.seats.get(slot);
    if (!seat) return;
    if (seat.peer !== peer) {
      // An old connection of a seat that already rejoined is ignored.
      if (!seat.peer && seat.dropped === peer && code === CLOSE_LEAVE) this.remove(slot);
      return;
    }
    if (code === CLOSE_LEAVE) {
      this.remove(slot);
      return;
    }
    seat.peer = null;
    seat.dropped = peer;
    seat.droppedAt = now;
    // A drop never stops the clock: the player may rejoin and needs the frames to finish.
    this.broadcast({ t: 'away', slot, away: true });
  }

  message(slot: number, raw: string, now = Date.now()): void {
    const seat = this.seats.get(slot);
    if (!seat?.peer) return;
    if (!this.take(seat, now)) {
      hangUp(seat.peer, CLOSE_FLOOD, 'flood');
      this.remove(slot);
      return;
    }
    seat.lastMsg = now;
    if (raw.length > MAX_MESSAGE) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    // Valid JSON that isn't an object (null, 1, "x", [...]) is ignored too: `msg.t` on null would throw.
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;
    switch (msg.t) {
      case 'start':
        if (slot === this.host && Number.isInteger(msg.seed)) this.start(msg.seed >>> 0, now);
        break;
      case 'profile': {
        const color = Number.isInteger(msg.color) && this.colorFree(msg.color, slot) ? msg.color : seat.profile.color;
        seat.profile = { slot, name: cleanName(msg.name, slot), color };
        this.broadcast({ t: 'profile', player: seat.profile });
        break;
      }
      case 'settings':
        if (slot !== this.host) return;
        this.settings = cleanSettings(msg.s, this.seats.size);
        this.broadcast({ t: 'settings', s: this.settings });
        break;
      case 'in':
        this.input(slot, msg);
        break;
      case 'ping':
        if (Number.isInteger(msg.id)) this.sendTo(slot, { t: 'pong', id: msg.id });
        break;
      case 'over':
        if (this.round && msg.r === this.round.r) {
          this.round.over.add(slot);
          this.checkOver();
        }
        break;
      case 'hash':
        if (msg.r === this.r && Number.isInteger(msg.tick) && Number.isInteger(msg.h)) this.broadcast({ t: 'hash', slot, r: msg.r, tick: msg.tick, h: msg.h }, slot);
        break;
    }
  }

  /** Call often (every ~16-33 ms) while busy: sends due ticks and expires dropped seats. */
  pump(now = Date.now()): void {
    for (const [slot, seat] of this.seats) {
      if (!seat.peer && now - seat.droppedAt > REJOIN_MS) this.remove(slot);
      else if (seat.peer && now - seat.lastMsg > SILENT_MS) {
        hangUp(seat.peer, CLOSE_AWAY, 'away');
        this.remove(slot);
      }
    }
    const round = this.round;
    if (!round?.active) return;
    if (now > round.endBy) {
      round.active = false;
      return;
    }
    const due = Math.floor((now - round.startAt) / TICK_MS);
    if (due <= round.sent) return;
    const first = round.sent;
    const batch: number[][] = [];
    for (let t = first; t < due; t++) batch.push(this.frame(round, t));
    round.sent = due;
    round.frames.push(...batch);
    this.sendEach(round.players.map((p) => p.slot), { t: 'f', r: round.r, tick: first, c: batch });
  }

  /** Everyone still connected has finished the round: stop the clock. Only an 'over' or a seat freed for good asks. */
  private checkOver(): void {
    const round = this.round;
    if (!round?.active || round.over.size === 0) return;
    const still = round.players.filter((p, i) => !round.left[i] && this.seats.get(p.slot)?.peer);
    if (still.length > 0 && still.every((p) => round.over.has(p.slot))) round.active = false;
  }

  /** Everyone's command for tick t. */
  private frame(round: Round, t: number): number[] {
    return round.players.map((p, i) => {
      if (round.left[i]) return FRAME_LEFT;
      const pending = round.pending[i];
      const mine = pending.get(t);
      // Ticks are framed in order and inputs only land on ticks not yet framed,
      // so t is the only key that can be due: no need to scan the whole map.
      pending.delete(t);
      if (mine !== undefined) {
        round.last[i] = mine;
        return mine;
      }
      // Late or missing: keep moving the same way, but never place again by accident.
      if (!this.seats.get(p.slot)?.peer) return 0;
      return round.last[i] & ~64;
    });
  }

  private start(seed: number, now: number): void {
    const connected = [...this.seats.entries()].filter(([, s]) => s.peer).sort(([a], [b]) => a - b);
    this.settings = cleanSettings(this.settings, this.seats.size);
    // Alone is fine with bots; otherwise it takes two.
    if (connected.length + this.settings.bots < 2) return;
    this.r++;
    const players = connected.map(([, s]) => s.profile);
    const n = players.length;
    this.round = {
      r: this.r, seed, players, settings: this.settings, startAt: now, sent: 0, frames: [],
      pending: Array.from({ length: n }, () => new Map()), last: Array(n).fill(0), left: Array(n).fill(false),
      over: new Set(), active: true, endBy: now + this.settings.time * 1000 + ROUND_SLACK_MS,
    };
    this.broadcast({ t: 'start', r: this.r, seed, players, settings: this.settings });
  }

  private input(slot: number, msg: Extract<ClientMsg, { t: 'in' }>): void {
    const round = this.round;
    if (!round?.active || msg.r !== round.r) return;
    const i = round.players.findIndex((p) => p.slot === slot);
    if (i < 0 || round.left[i]) return;
    if (!Number.isInteger(msg.tick) || !Array.isArray(msg.c) || msg.c.length === 0 || msg.c.length > MAX_BATCH) return;
    if (!msg.c.every(isPacked) || msg.tick > round.sent + MAX_AHEAD) return;
    // Ticks already sent are too late; the rest wait for their turn.
    msg.c.forEach((c, k) => {
      if (msg.tick + k >= round.sent) round.pending[i].set(msg.tick + k, c);
    });
  }

  private reattach(slot: number, seat: Seat, peer: Peer, now: number): number {
    seat.peer = peer;
    seat.droppedAt = 0;
    seat.dropped = null;
    seat.lastMsg = now;
    seat.bucket = { tokens: BURST, at: now };
    this.welcome(slot);
    this.broadcast({ t: 'away', slot, away: false }, slot);
    const round = this.round;
    if (round && round.players.some((p, i) => p.slot === slot && !round.left[i])) {
      this.sendTo(slot, { t: 'resume', r: round.r, seed: round.seed, players: round.players, settings: round.settings, c: round.frames });
    }
    return slot;
  }

  private welcome(slot: number): void {
    const seat = this.seats.get(slot)!;
    this.sendTo(slot, {
      t: 'welcome', you: slot, host: this.host, players: this.profiles(), settings: this.settings,
      playing: !!this.round?.active, token: seat.token, ...(this.where ? { where: this.where } : {}),
    });
  }

  /** Frees a seat for good: out of the current round from the next tick. */
  private remove(slot: number): void {
    if (!this.seats.delete(slot)) return;
    if (this.host === slot) this.host = this.empty ? -1 : Math.min(...this.seats.keys());
    const round = this.round;
    const i = round ? round.players.findIndex((p) => p.slot === slot) : -1;
    if (round && i >= 0) {
      round.left[i] = true;
      round.pending[i].clear();
    }
    this.broadcast({ t: 'left', slot, host: this.host });
    if (this.empty) {
      this.round = null;
      return;
    }
    // The last unfinished round player is gone for good: stop the clock.
    this.checkOver();
  }

  /** Takes one message from the peer's flood-guard bucket; false when it is empty. */
  private take(seat: Seat, now: number): boolean {
    const b = seat.bucket;
    b.tokens = Math.min(BURST, b.tokens + ((now - b.at) / 1000) * RATE) - 1;
    b.at = now;
    return b.tokens >= 0;
  }

  /** A newcomer may push the total over 4: the host's bot count shrinks to fit. */
  private clampBots(): void {
    const s = cleanSettings(this.settings, this.seats.size);
    if (s.bots === this.settings.bots) return;
    this.settings = s;
    this.broadcast({ t: 'settings', s });
  }

  private colorFree(color: number, slot: number): boolean {
    return color >= 0 && color < PLAYER_COLORS.length && ![...this.seats.values()].some((s) => s.profile.slot !== slot && s.profile.color === color);
  }

  /** The wished colour if nobody has it, else the first free one. */
  private freeColor(wish: number): number {
    if (this.colorFree(wish, -1)) return wish;
    let c = 0;
    while (!this.colorFree(c, -1)) c++;
    return c;
  }

  private profiles(): Profile[] {
    return [...this.seats.entries()].sort(([a], [b]) => a - b).map(([, s]) => s.profile);
  }

  private sendTo(slot: number, msg: ServerMsg): void {
    try { this.seats.get(slot)?.peer?.send(JSON.stringify(msg)); } catch { /* closing */ }
  }

  /** Encodes `msg` once and sends the same text to every listed seat that is connected. */
  private sendEach(slots: Iterable<number>, msg: ServerMsg, except = -1): void {
    let data: string | null = null;
    for (const slot of slots) {
      const peer = slot === except ? null : this.seats.get(slot)?.peer;
      if (!peer) continue;
      data ??= JSON.stringify(msg);
      try { peer.send(data); } catch { /* closing */ }
    }
  }

  private broadcast(msg: ServerMsg, except = -1): void {
    this.sendEach(this.seats.keys(), msg, except);
  }
}
