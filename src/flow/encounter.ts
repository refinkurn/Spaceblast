import { TILE, type Kind } from '../sim/constants';
import { playerTile, type GameState } from '../sim/state';

/** How close (in tiles, walking distance) a Martian must come to count as met. */
export const ENCOUNTER_TILES = 3;

/** Kinds of Martians close to the hero right now (hidden Phasers don't count). */
export function martiansNear(state: GameState, tiles = ENCOUNTER_TILES): Set<Kind> {
  const out = new Set<Kind>();
  const hero = state.players[0];
  if (!hero?.alive) return out;
  const [hx, hy] = playerTile(hero);
  for (const m of state.martians) {
    if (!m.alive || m.hidden) continue;
    if (Math.abs(Math.round(m.x / TILE) - hx) + Math.abs(Math.round(m.y / TILE) - hy) <= tiles) out.add(m.kind);
  }
  return out;
}
