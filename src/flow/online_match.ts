import { Bot } from '../input/bot';
import { FrameSync } from '../net/frames';
import { PLAYER_COLORS, WINS_NEEDED, type Profile, type RoomSettings } from '../net/protocol';
import type { PlayerCommand } from '../sim/command';
import { START_HOLD_TICKS } from '../sim/constants';
import { NO_EVENTS } from '../sim/levels';
import type { GameOptions, GameState } from '../sim/state';
import { botColorsFor, type RoundStart } from './online';
import { t } from '../utils/i18n';

// One online round: who plays (humans from the room, then bots), the server's
// frames, and the desync check. Every browser builds exactly the same
// round from the server's start message.

const hex = (css: string) => parseInt(css.slice(1), 16);

export class OnlineRound {
  readonly r: number;
  readonly seed: number;
  readonly local: number;
  readonly humans: Profile[];
  readonly settings: RoomSettings;
  /** The server's frames for this round. */
  readonly sync: FrameSync;
  /** Bots run on every browser from the same seed, so they agree too. */
  readonly bots: Bot[];
  /** Per sim player: display name, colour (0xRRGGBB) and score key. */
  readonly names: string[] = [];
  readonly colors: number[] = [];
  readonly keys: string[] = [];
  /** Told the server this round is over. */
  overSent = false;
  private myHashes = new Map<number, number>();
  private pendingHashes = new Map<number, number[]>();

  constructor(s: RoundStart) {
    this.r = s.r;
    this.seed = s.seed;
    this.local = s.local;
    this.humans = s.players;
    this.settings = s.settings;
    this.sync = new FrameSync(s.players.length);
    this.sync.local = s.local;
    if (s.frames) this.sync.receive(0, s.frames);
    const botColors = botColorsFor(s.players);
    for (const p of s.players) {
      this.names.push(p.name);
      this.colors.push(hex(PLAYER_COLORS[p.color]));
      this.keys.push(`p${p.slot}`);
    }
    this.bots = Array.from({ length: s.settings.bots }, (_, i) => {
      this.names.push(t('lobby.bot', { n: i + 1 }));
      this.colors.push(hex(PLAYER_COLORS[botColors[i]]));
      this.keys.push(`b${i}`);
      return new Bot(s.players.length + i, s.seed, s.settings.botLevel);
    });
  }

  /** Round wins needed to take the match. */
  get winsNeeded(): number {
    return WINS_NEEDED[this.settings.match];
  }

  get players(): number {
    return this.names.length;
  }

  gameOptions(): GameOptions {
    const { time, maze, blackout, arena } = this.settings;
    return {
      mode: 'battle',
      players: this.players,
      roundTicks: time * 60,
      // The 3-2-1-BLAST! count runs in the sim online (frames keep flowing), not as a client pause.
      startHold: START_HOLD_TICKS,
      rules: { ...NO_EVENTS, mazeShift: maze, blackout },
      // 'random' is picked from the round seed, so every browser builds the same grid.
      arena,
    };
  }

  /** Sim player id of a room slot, or -1. */
  idOf(slot: number): number {
    return this.humans.findIndex((p) => p.slot === slot);
  }

  /** Commands for the next tick (humans from the server's frame, then bots), or null until it arrives. */
  commands(state: GameState): PlayerCommand[] | null {
    if (!this.sync.ready()) return null;
    const bots = this.bots.map((b) => b.think(state));
    return [...this.sync.next(), ...bots];
  }

  /** Frames from the server. */
  receive(r: number, tick: number, c: number[][]): void {
    if (r === this.r) this.sync.receive(tick, c);
  }

  /** This browser's command now (sent ahead to the server). */
  input(local: PlayerCommand): void {
    this.sync.input(local);
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

/** Round wins across a match, by player key (room slot or bot number, or index offline). */
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

  win(key: string, needed: number): void {
    this.wins.set(key, this.of(key) + 1);
    this.over = this.of(key) >= needed;
  }

  of(key: string): number {
    return this.wins.get(key) ?? 0;
  }
}
