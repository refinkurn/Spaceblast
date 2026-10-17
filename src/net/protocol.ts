import { Dir, ROUND_SECONDS } from '../sim/constants';
import type { PlayerCommand } from '../sim/command';

// Online rooms: the messages between a browser and the relay server.
// The relay only forwards inputs; every browser runs the same deterministic
// sim (lockstep), so the game itself never travels over the network.

export const MAX_PLAYERS = 4;
/** Room codes: 4 letters, no I or O (they look like 1 and 0). */
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export function isRoomCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_LETTERS.includes(c));
}

/** Astronaut colours to pick from (placeholder for characters). */
export const PLAYER_COLORS = ['#3a7bff', '#ff6a3d', '#4fd17a', '#c77dff', '#ff5fa2', '#ffd23f', '#3fd8e0', '#e8ecf5'];
export const NAME_MAX = 12;

/** A human in the room. */
export interface Profile {
  slot: number;
  name: string;
  /** Index into PLAYER_COLORS. */
  color: number;
}

/** What the host picks in the lobby. */
export interface RoomSettings {
  /** Round time in seconds before the arena collapses (one of ROUND_SECONDS). */
  time: number;
  maze: boolean;
  blackout: boolean;
  /** Bots added to the match; humans + bots never exceed MAX_PLAYERS. */
  bots: number;
  botLevel: BotLevel;
  /** Best of 3 (first to 2 round wins) or first to 3 round wins. */
  match: MatchFormat;
}

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];
export const MATCH_FORMATS = ['bo3', 'ft3'] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];
/** Round wins needed to take the match. */
export const WINS_NEEDED: Record<MatchFormat, number> = { bo3: 2, ft3: 3 };

export const DEFAULT_SETTINGS: RoomSettings = { time: 120, maze: false, blackout: false, bots: 0, botLevel: 'normal', match: 'ft3' };

/** Trims a typed name to something safe to show; empty becomes "Player N". */
export function cleanName(raw: unknown, slot: number): string {
  const clean = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim() : '';
  // Cut by characters, not UTF-16 units, so an emoji is never split in half.
  const name = Array.from(clean).slice(0, NAME_MAX).join('').trim();
  return name || `Player ${slot + 1}`;
}

/** Validates settings from a browser, keeping humans + bots within MAX_PLAYERS. */
export function cleanSettings(raw: Partial<RoomSettings> | undefined, humans: number): RoomSettings {
  const time = ROUND_SECONDS.includes(Number(raw?.time)) ? Number(raw!.time) : DEFAULT_SETTINGS.time;
  const bots = Math.max(0, Math.min(MAX_PLAYERS - humans, Math.floor(Number(raw?.bots) || 0)));
  const botLevel = BOT_LEVELS.find((l) => l === raw?.botLevel) ?? DEFAULT_SETTINGS.botLevel;
  const match = MATCH_FORMATS.find((m) => m === raw?.match) ?? DEFAULT_SETTINGS.match;
  return { time, maze: raw?.maze === true, blackout: raw?.blackout === true, bots, botLevel, match };
}

/** Browser -> server. Name and colour wishes go in the URL: /room/CODE?name=..&color=.. */
export type ClientMsg =
  /** Host only: start a round with everyone in the room. */
  | { t: 'start'; seed: number }
  /** Change your name or colour (a colour someone else has is refused). */
  | { t: 'profile'; name: string; color: number }
  /** Host only: lobby settings. */
  | { t: 'settings'; s: RoomSettings }
  /** Packed commands for ticks `tick`, `tick + 1`, ... of round `r`. */
  | { t: 'in'; r: number; tick: number; c: number[] }
  /** Sent every second while this browser's game is running (inputs also count). */
  | { t: 'alive' }
  /** State hash after `tick` of round `r`, to spot desyncs. */
  | { t: 'hash'; r: number; tick: number; h: number };

/** WebSocket close code for a player dropped for being away (app in background). */
export const CLOSE_AWAY = 4001;
/** A player silent this long while others play is dropped from the room. */
export const AWAY_MS = 8000;

export type ErrorReason = 'taken' | 'not_found' | 'full' | 'bad_code';

/** Server -> browser. A slot is a seat in the room (0-3) and stays the same all match. */
export type ServerMsg =
  | { t: 'welcome'; you: number; host: number; players: Profile[]; settings: RoomSettings; playing: boolean }
  /** Someone joined, or changed name or colour. */
  | { t: 'profile'; player: Profile }
  | { t: 'settings'; s: RoomSettings }
  /** `lastTick`: the last tick this player sent input for in the current round (-1 if none). */
  | { t: 'left'; slot: number; host: number; lastTick: number }
  /** Round `r` starts. Sim player i is `players[i]`; bots come after them. */
  | { t: 'start'; r: number; seed: number; players: Profile[]; settings: RoomSettings }
  | { t: 'in'; slot: number; r: number; tick: number; c: number[] }
  | { t: 'hash'; slot: number; r: number; tick: number; h: number }
  | { t: 'error'; reason: ErrorReason };

/** One command in 7 bits: dir | alt << 3 | place << 6. */
export function packCommand(c: PlayerCommand): number {
  return c.dir | (c.alt << 3) | (c.place ? 64 : 0);
}

export function unpackCommand(n: number): PlayerCommand {
  return { dir: (n & 7) as Dir, alt: ((n >> 3) & 7) as Dir, place: (n & 64) !== 0 };
}

export function isPacked(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < 128 && ((n as number) & 7) <= Dir.Right && (((n as number) >> 3) & 7) <= Dir.Right;
}
