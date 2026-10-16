import { canWalk, tickCharges, tryPlace, updateLives, updatePassable } from './charges';
import { NO_COMMAND, type PlayerCommand } from './command';
import { movePlayer } from './movement';
import type { GameState } from './state';

/** Advances the game by exactly one tick. `commands[i]` belongs to player i. */
export function step(state: GameState, commands: readonly PlayerCommand[]): void {
  state.tick++;
  state.events = [];
  for (const p of state.players) {
    if (!p.alive) continue;
    const cmd = commands[p.id] ?? NO_COMMAND;
    tryPlace(state, p, cmd.place);
    movePlayer((tx, ty) => canWalk(state, p, tx, ty), p, cmd);
    updatePassable(state, p);
  }
  tickCharges(state);
  updateLives(state);
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
  for (const b of state.beams) mix(b);
  for (const p of state.players) {
    mix(p.x);
    mix(p.y);
    mix(p.facing);
    mix(p.alive ? 1 : 0);
    mix(p.respawn);
    mix(p.range);
    mix(p.maxCharges);
    mix(p.placeHeld ? 1 : 0);
    for (const id of p.passable) mix(id);
  }
  mix(state.nextChargeId);
  for (const c of state.charges) {
    mix(c.id);
    mix(c.owner);
    mix(c.tx);
    mix(c.ty);
    mix(c.fuse);
    mix(c.range);
  }
  return h >>> 0;
}
