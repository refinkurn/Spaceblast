import {
  CLOSE_AWAY, CLOSE_FLOOD, CLOSE_LEAVE, CLOSE_RETRY, DEFAULT_SETTINGS, MAX_PLAYERS, PLAYER_COLORS, REJOIN_MS, cleanName, cleanSettings, cleanVersion, trimName,
  type ClientMsg, type ErrorReason, type Profile, type RoomSettings, type ServerMsg,
} from '../src/net/protocol';
import { fullBucket, hangUp, newToken, sameBuild, takeToken, type Bucket, type JoinRequest, type Peer } from './room_join';
import { RoundClock } from './round_clock';

export { requestFromUrl, type JoinRequest, type Peer } from './room_join';
export { TICK_MS } from './round_clock';

// One online room. Used by both the local dev relay (server/dev_relay.ts) and
// the Cloudflare Worker (server/worker.ts). It knows nothing about the game
// rules: it seats players (name + colour), keeps the host's settings, starts
// rounds, and drives the round clock (server/round_clock.ts).
//
// A dropped player may reconnect within REJOIN_MS and gets the round so far to
// catch up; after that they are out for the round. A room only seats one build
// of the game: the first player's (see JoinRequest.version).

/** Biggest message a browser ever needs to send. */
const MAX_MESSAGE = 2048;
/** A connected browser that sends nothing for this long is gone (it pings every second). */
const SILENT_MS = 30000;
interface Seat {
  peer: Peer | null;
  profile: Profile;
  token: string;
  /** When the connection dropped (seat kept for REJOIN_MS). */
  droppedAt: number;
  /** The connection that dropped: its late deliberate close (after an error) still frees the seat. */
  dropped: Peer | null;
  lastMsg: number;
  bucket: Bucket;
}

export interface RoomOptions {
  /** Dev server only: a page built as 'dev' joins any room, and anyone joins a 'dev' room. */
  devVersions?: boolean;
}

export class Room {
  private seats = new Map<number, Seat>();
  private settings: RoomSettings = { ...DEFAULT_SETTINGS };
  private host = -1;
  private round: RoundClock | null = null;
  private r = 0;
  /** The build of the room's first player; '' for a page from before the version check. */
  private version = '';
  /** Where this room runs (a Cloudflare data centre code like "SIN"), shown in the stats overlay. */
  where = '';

  constructor(private readonly opts: RoomOptions = {}) {}

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
    const version = cleanVersion(req.version);
    if (req.rejoin !== null && req.rejoin !== undefined) {
      const seat = this.seats.get(req.rejoin);
      if (!seat || seat.token !== req.token) return fail('expired');
      // The page was reloaded into a new build: it would play the round differently.
      if (!this.fits(version)) return fail('update');
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
    if (!this.empty && !this.fits(version)) return fail('update');
    if (this.seats.size >= MAX_PLAYERS) return fail('full');
    if (this.empty) this.version = version;
    let slot = 0;
    while (this.seats.has(slot)) slot++;
    const profile: Profile = { slot, name: cleanName(req.name, slot), color: this.freeColor(req.color ?? -1) };
    this.broadcast({ t: 'profile', player: profile });
    this.seats.set(slot, { peer, profile, token: newToken(), droppedAt: 0, dropped: null, lastMsg: now, bucket: fullBucket(now) });
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
    if (!takeToken(seat.bucket, now)) {
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
        // Not while a round runs (a stale tap would restart it for everyone).
        if (slot === this.host && Number.isInteger(msg.seed) && (this.round?.canRestart(now) ?? true)) this.start(msg.seed >>> 0, now);
        break;
      case 'profile': {
        const color = Number.isInteger(msg.color) && this.colorFree(msg.color, slot) ? msg.color : seat.profile.color;
        // No name (missing, empty or only spaces): keep the current one.
        seat.profile = { slot, name: trimName(msg.name) || seat.profile.name, color };
        this.broadcast({ t: 'profile', player: seat.profile });
        break;
      }
      case 'settings':
        if (slot !== this.host) return;
        this.settings = cleanSettings(msg.s, this.seats.size);
        this.broadcast({ t: 'settings', s: this.settings });
        break;
      case 'in':
        this.round?.input(slot, msg);
        break;
      case 'ping':
        if (Number.isInteger(msg.id)) this.sendTo(slot, { t: 'pong', id: msg.id });
        break;
      case 'over':
        if (this.round && msg.r === this.round.r) this.round.finish(slot, now, this.connected);
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
    const out = round?.due(now, this.connected);
    if (round && out) this.sendEach(round.slots, { t: 'f', r: round.r, ...out });
  }

  private readonly connected = (slot: number): boolean => !!this.seats.get(slot)?.peer;

  /** A page of this build may sit in this room (the first player's build). */
  private fits(version: string): boolean {
    return sameBuild(this.version, version, !!this.opts.devVersions);
  }

  private start(seed: number, now: number): void {
    const connected = [...this.seats.entries()].filter(([, s]) => s.peer).sort(([a], [b]) => a - b);
    this.settings = cleanSettings(this.settings, this.seats.size);
    // Alone is fine with bots; otherwise it takes two.
    if (connected.length + this.settings.bots < 2) return;
    this.r++;
    const players = connected.map(([, s]) => s.profile);
    this.round = new RoundClock(this.r, seed, players, this.settings, now);
    this.broadcast({ t: 'start', r: this.r, seed, players, settings: this.settings });
  }

  private reattach(slot: number, seat: Seat, peer: Peer, now: number): number {
    seat.peer = peer;
    seat.droppedAt = 0;
    seat.dropped = null;
    seat.lastMsg = now;
    seat.bucket = fullBucket(now);
    this.welcome(slot);
    this.broadcast({ t: 'away', slot, away: false }, slot);
    const round = this.round;
    if (round?.plays(slot)) {
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
    this.round?.leave(slot);
    this.broadcast({ t: 'left', slot, host: this.host });
    if (this.empty) {
      this.round = null;
      return;
    }
    // The last unfinished round player is gone for good: stop the clock.
    this.round?.checkOver(this.connected);
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
