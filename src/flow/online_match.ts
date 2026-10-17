import { Bot } from '../input/bot';
import { Lockstep } from '../net/lockstep';
import { PLAYER_COLORS, type Profile, type RoomSettings } from '../net/protocol';
import type { PlayerCommand } from '../sim/command';
import { NO_EVENTS } from '../sim/levels';
import type { GameOptions, GameState } from '../sim/state';
import { botColorsFor, type RoundStart } from './online';

// One online round: who plays (humans from the room, then bots), the lockstep
// input sync, and the desync check. Every browser builds exactly the same
// round from the server's start message.

/** Battle: first to this many round wins takes the match. */
export const ROUNDS_TO_WIN = 3;

const hex = (css: string) => parseInt(css.slice(1), 16);

export class OnlineRound {
  readonly r: number;
  readonly seed: number;
  readonly local: number;
  readonly humans: Profile[];
  readonly settings: RoomSettings;
  readonly lockstep: Lockstep;
  /** Bots run on every browser from the same seed, so they agree too. */
  readonly bots: Bot[];
  /** Per sim player: display name, colour (0xRRGGBB) and score key. */
  readonly names: string[] = [];
  readonly colors: number[] = [];
  readonly keys: string[] = [];
  private myHashes = new Map<number, number>();
  private pendingHashes = new Map<number, number[]>();

  constructor(s: RoundStart) {
    this.r = s.r;
    this.seed = s.seed;
    this.local = s.local;
    this.humans = s.players;
    this.settings = s.settings;
    this.lockstep = new Lockstep(s.players.length, s.local);
    const botColors = botColorsFor(s.players);
    for (const p of s.players) {
      this.names.push(p.name);
      this.colors.push(hex(PLAYER_COLORS[p.color]));
      this.keys.push(`p${p.slot}`);
    }
    this.bots = Array.from({ length: s.settings.bots }, (_, i) => {
      this.names.push(`Bot ${i + 1}`);
      this.colors.push(hex(PLAYER_COLORS[botColors[i]]));
      this.keys.push(`b${i}`);
      return new Bot(s.players.length + i, s.seed);
    });
  }

  get players(): number {
    return this.names.length;
  }

  gameOptions(): GameOptions {
    const { time, maze, blackout } = this.settings;
    return {
      mode: 'battle',
      players: this.players,
      roundTicks: time * 60,
      rules: { ...NO_EVENTS, mazeShift: maze, blackout },
    };
  }

  /** Sim player id of a room slot, or -1. */
  idOf(slot: number): number {
    return this.humans.findIndex((p) => p.slot === slot);
  }

  /** Commands for the next tick (humans via lockstep, then bots), or null while waiting for input. */
  commands(local: PlayerCommand, state: GameState): PlayerCommand[] | null {
    if (!this.lockstep.ready()) return null;
    const bots = this.bots.map((b) => b.think(state));
    return [...this.lockstep.advance(local), ...bots];
  }

  receive(slot: number, r: number, tick: number, c: number[]): void {
    if (r === this.r) this.lockstep.receive(this.idOf(slot), tick, c);
  }

  playerLeft(slot: number, lastTick: number): void {
    this.lockstep.playerLeft(this.idOf(slot), lastTick);
  }

  /** Names of the humans whose input hasn't arrived. */
  waitingFor(): string[] {
    return this.lockstep.waitingFor().map((id) => this.names[id]);
  }

  /** Records this browser's hash; true if another browser reported a different one. */
  ownHash(tick: number, h: number): boolean {
    this.myHashes.set(tick, h);
    const bad = this.pendingHashes.get(tick)?.some((x) => x !== h) ?? false;
    this.pendingHashes.delete(tick);
    return bad;
  }

  /** A hash from another browser; true on a mismatch. */
  otherHash(r: number, tick: number, h: number): boolean {
    if (r !== this.r) return false;
    const mine = this.myHashes.get(tick);
    if (mine === undefined) {
      this.pendingHashes.set(tick, [...(this.pendingHashes.get(tick) ?? []), h]);
      return false;
    }
    return mine !== h;
  }
}

/** Round wins across a match, by player key (room slot or bot number). */
export class MatchScore {
  round = 0;
  over = false;
  private wins = new Map<string, number>();

  /** Called when a round starts: a new match after the last one ended. */
  nextRound(fresh: boolean): void {
    if (fresh || this.over) {
      this.wins.clear();
      this.round = 0;
      this.over = false;
    }
    this.round++;
  }

  win(key: string): void {
    this.wins.set(key, this.of(key) + 1);
    this.over = this.of(key) >= ROUNDS_TO_WIN;
  }

  of(key: string): number {
    return this.wins.get(key) ?? 0;
  }
}
