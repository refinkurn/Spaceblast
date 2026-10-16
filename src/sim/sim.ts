import { NO_COMMAND, type PlayerCommand } from './command';
import { movePlayer } from './movement';
import type { GameState } from './state';

/** Advances the game by exactly one tick. `commands[i]` belongs to player i. */
export function step(state: GameState, commands: readonly PlayerCommand[]): void {
  state.tick++;
  for (const p of state.players) {
    if (!p.alive) continue;
    movePlayer(state.grid, p, commands[p.id] ?? NO_COMMAND);
  }
}

/**
 * 32-bit FNV-1a hash of everything that matters. Two peers (or a replay)
 * with equal hashes are in the same state; used for desync checks.
 */
export function hashState(state: GameState): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= v & 0xff; h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff; h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff; h = Math.imul(h, 0x01000193);
  };
  mix(state.tick);
  mix(state.rng);
  for (const c of state.grid.cells) mix(c);
  for (const p of state.players) {
    mix(p.x);
    mix(p.y);
    mix(p.facing);
    mix(p.alive ? 1 : 0);
  }
  return h >>> 0;
}
