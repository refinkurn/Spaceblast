import { RESPAWN_TICKS, SPAWN_SHIELD_TICKS } from './constants';
import { gateOpen } from './items';
import { biteAt } from './martians';
import { playerTile, warpToSpawn, type GameState, type Player } from './state';

// Knock-outs (beams and bites), protection, lives, and the level outcome.

function knockOut(state: GameState, p: Player): void {
  const [tx, ty] = playerTile(p);
  p.alive = false;
  p.lives--;
  p.respawn = RESPAWN_TICKS;
  p.placeHeld = false;
  p.vest = 0;
  state.events.push({ type: 'player_died', id: p.id, tx, ty });
}

/** Is the player hurt by the beam on its tile? The vest blocks the player's own beams. */
function beamHurts(state: GameState, p: Player): boolean {
  const [tx, ty] = playerTile(p);
  const i = ty * state.grid.w + tx;
  if (state.beams[i] === 0) return false;
  return !(p.vest > 0 && state.beamOwner[i] === p.id + 1);
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
    if (p.shield > 0) p.shield--;
    if (p.vest > 0) p.vest--;
    if (p.shield > 0) continue;
    const bitten = p.vest === 0 && biteAt(state, p.x, p.y);
    if (bitten || beamHurts(state, p)) knockOut(state, p);
  }
}

/** Battle: last astronaut standing wins; the round is a draw when time runs out or nobody is left. */
function battleOutcome(state: GameState): void {
  if (state.timeLeft > 0) state.timeLeft--;
  const standing = state.players.filter((p) => p.alive);
  if (standing.length > 1 && state.timeLeft > 0) return;
  state.status = 'round_over';
  state.winner = standing.length === 1 ? standing[0].id : -1;
  state.events.push({ type: 'round_over', winner: state.winner });
}

/** Survival: clear the level on the open Warp Gate, or lose when all lives are gone. */
export function updateOutcome(state: GameState): void {
  if (state.mode === 'battle') return battleOutcome(state);
  if (state.players.every((p) => !p.alive && p.lives <= 0)) {
    state.status = 'game_over';
    state.events.push({ type: 'game_over' });
    return;
  }
  if (!gateOpen(state)) return;
  const gx = state.gate % state.grid.w, gy = Math.floor(state.gate / state.grid.w);
  if (state.players.some((p) => p.alive && playerTile(p)[0] === gx && playerTile(p)[1] === gy)) {
    state.status = 'cleared';
    state.events.push({ type: 'level_clear' });
  }
}
