import { updateBoss } from './boss';
import { updateCollapse } from './collapse';
import { canWalk, tickCharges, tryPlace, updatePassable } from './charges';
import { NO_COMMAND, type PlayerCommand } from './command';
import { gateOpen, pickUpItems, playerSpeed } from './items';
import { updateLevelEvents } from './level_events';
import { forfeit, updateLives, updateOutcome } from './lives';
import { updateMartians } from './martians';
import { movePlayer } from './movement';
import type { GameState } from './state';

/** Advances the game by exactly one tick. `commands[i]` belongs to player i. */
export function step(state: GameState, commands: readonly PlayerCommand[]): void {
  state.events = [];
  if (state.status !== 'playing') return;
  state.tick++;
  const gateWasOpen = gateOpen(state);

  for (const p of state.players) {
    if (!p.alive) continue;
    const cmd = commands[p.id] ?? NO_COMMAND;
    if (cmd.leave) {
      forfeit(state, p);
      continue;
    }
    tryPlace(state, p, cmd.place);
    movePlayer((tx, ty) => canWalk(state, p, tx, ty), p, cmd, playerSpeed(p));
    updatePassable(state, p);
    pickUpItems(state, p);
  }
  tickCharges(state);
  updateMartians(state);
  updateLevelEvents(state);
  updateBoss(state);
  updateCollapse(state);
  updateLives(state);
  if (!gateWasOpen && gateOpen(state)) state.events.push({ type: 'gate_opened' });
  updateOutcome(state);
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
  mix(['playing', 'cleared', 'game_over', 'round_over'].indexOf(state.status));
  mix(state.mode === 'battle' ? 1 : 0);
  mix(state.winner);
  mix(state.timeLeft);
  mix(state.collapseTicks);
  mix(state.collapseNext);
  mix(state.gate);
  mix(state.freeze);
  for (const v of [state.event, state.eventWarning, state.eventActive, state.nextEvent, state.gateWait]) mix(v);
  const r = state.rules;
  for (const v of [r.mazeShift, r.gateWander, r.blackout, r.frequentEvents, r.aggressive, state.rival]) mix(v ? 1 : 0);
  if (state.boss) for (const v of [state.boss.kind, state.boss.tile, state.boss.wave, state.boss.timer, state.boss.alive ? 1 : 0]) mix(v);
  for (const v of state.beamRock) mix(v);
  for (const i of state.shiftRemove) mix(i);
  for (const i of state.shiftAdd) mix(i);
  for (const c of state.grid.cells) mix(c);
  for (const v of state.items) mix(v);
  for (const b of state.beams) mix(b);
  for (const o of state.beamOwner) mix(o);
  for (const p of state.players) {
    for (const v of [p.x, p.y, p.facing, p.alive ? 1 : 0, p.lives, p.respawn, p.shield, p.range, p.maxCharges, p.boots, p.armor, p.placeHeld ? 1 : 0]) mix(v);
    for (const id of p.passable) mix(id);
  }
  for (const m of state.martians) for (const v of [m.id, m.kind, m.x, m.y, m.dir, m.alive ? 1 : 0, m.timer, m.hidden ? 1 : 0, m.built]) mix(v);
  for (const p of state.portals) for (const v of [p.from, p.to, p.ticks]) mix(v);
  mix(state.nextChargeId);
  for (const c of state.charges) for (const v of [c.id, c.owner, c.tx, c.ty, c.fuse, c.range]) mix(v);
  return h >>> 0;
}
