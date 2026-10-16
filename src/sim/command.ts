import { Dir } from './constants';

/**
 * Everything a player can do in one tick. Input sources (keyboard, touch,
 * bots, later the network) only ever produce these; the sim never reads
 * devices directly.
 */
export interface PlayerCommand {
  /** Primary direction. */
  dir: Dir;
  /** Perpendicular fallback when `dir` is blocked (diagonal input), or None. */
  alt: Dir;
  /** Place a Plasma Charge (used from Phase 2). */
  place: boolean;
}

export const NO_COMMAND: PlayerCommand = Object.freeze({ dir: Dir.None, alt: Dir.None, place: false });
