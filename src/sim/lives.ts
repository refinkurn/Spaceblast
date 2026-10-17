import { RESPAWN_TICKS, SPAWN_SHIELD_TICKS } from './constants';
import { gateOpen } from './items';
import { biteAt } from './martians';
import { playerTile, warpToSpawn, type GameState, type Player } from './state';

// Knock-outs (beams and bites), armor, lives, and the level outcome.

function knockOut(state: GameState, p: Player): void {
  const [tx, ty] = playerTile(p);
  p.alive = false;
  p.lives--;
  p.respawn = RESPAWN_TICKS;
  p.placeHeld = false;
  state.events.push({ type: 'player_died', id: p.id, tx, ty });
}

/** A player who left an online room: out for good, whatever lives or armor they had. */
export function forfeit(state: GameState, p: Player): void {
  if (!p.alive) return;
  p.lives = 1;
  p.armor = 0;
  knockOut(state, p);
}

/** A hit costs an Oxygen Vest armor point (plus a short shield) before it costs a life. */
function hit(state: GameState, p: Player): void {
  if (p.armor > 0) {
    p.armor--;
    p.shield = SPAWN_SHIELD_TICKS;
    state.events.push({ type: 'armor_hit', id: p.id });
    return;
  }
  knockOut(state, p);
}

function inBeam(state: GameState, p: Player): boolean {
  const [tx, ty] = playerTile(p);
  return state.beams[ty * state.grid.w + tx] > 0;
}

export function updateLives(state: GameState): void {
  for (const p of state.players) {
    if (!p.alive) {
      if (p.lives > 0 && --p.respawn <= 0) {
        warpToSpawn(p);
        p.alive = true;
        p.shield = SPAWN_SHIELD_TICKS;
        state.events.push({ type: 'player_respawned', id: p.id });
      }
      continue;
    }
    if (p.shield > 0) {
      p.shield--;
      continue;
    }
    if (biteAt(state, p.x, p.y) || inBeam(state, p)) hit(state, p);
  }
}

/**
 * Battle: last astronaut standing wins; a draw when nobody is left. When the
 * clock runs out the arena collapses (collapse.ts) until someone wins.
 */
function battleOutcome(state: GameState): void {
  if (state.timeLeft > 0) state.timeLeft--;
  const standing = state.players.filter((p) => p.alive);
  if (standing.length > 1) return;
  state.status = 'round_over';
  state.winner = standing.length === 1 ? standing[0].id : -1;
  state.events.push({ type: 'round_over', winner: state.winner });
}

function clear(state: GameState): void {
  state.status = 'cleared';
  state.events.push({ type: 'level_clear' });
}

/**
 * Survival: lose when the astronaut's last life is gone. Win by stepping on the
 * open Warp Gate, by outlasting a boss, or (level 20) by defeating the rival.
 */
export function updateOutcome(state: GameState): void {
  if (state.mode === 'battle') return battleOutcome(state);
  const hero = state.players[0];
  if (!hero.alive && hero.lives <= 0) {
    state.status = 'game_over';
    state.events.push({ type: 'game_over' });
    return;
  }
  if (state.boss) {
    if (!state.boss.alive) clear(state);
    return;
  }
  if (state.rival) {
    const rival = state.players[1];
    if (rival && !rival.alive && rival.lives <= 0) clear(state);
    return;
  }
  if (!gateOpen(state)) return;
  const gx = state.gate % state.grid.w, gy = Math.floor(state.gate / state.grid.w);
  if (state.players.some((p) => p.alive && playerTile(p)[0] === gx && playerTile(p)[1] === gy)) clear(state);
}
