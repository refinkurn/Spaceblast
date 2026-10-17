import { Dir } from '../sim/constants';
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

/** Browser -> server. */
export type ClientMsg =
  /** Host only: start a round with these players (all slots in the room). */
  | { t: 'start'; seed: number }
  /** Packed commands for ticks `tick`, `tick + 1`, ... of round `r`. */
  | { t: 'in'; r: number; tick: number; c: number[] }
  /** State hash after `tick` of round `r`, to spot desyncs. */
  | { t: 'hash'; r: number; tick: number; h: number };

export type ErrorReason = 'taken' | 'not_found' | 'full' | 'bad_code';

/** Server -> browser. A slot is a seat in the room (0-3) and stays the same all match. */
export type ServerMsg =
  | { t: 'welcome'; you: number; host: number; slots: number[]; playing: boolean }
  | { t: 'joined'; slot: number }
  /** `lastTick`: the last tick this player sent input for in the current round (-1 if none). */
  | { t: 'left'; slot: number; host: number; lastTick: number }
  /** Round `r` starts; player id i in the sim is `slots[i]`. */
  | { t: 'start'; r: number; seed: number; slots: number[] }
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
