import { Dir, SPAWNS, TILE } from './constants';
import { generateGrid, type Grid } from './grid';
import { seedRng } from './rng';

export interface Player {
  id: number;
  /** Position in sub-units (TILE per tile); a tile centre is tile * TILE. */
  x: number;
  y: number;
  facing: Dir;
  alive: boolean;
}

export interface GameState {
  tick: number;
  seed: number;
  rng: number;
  grid: Grid;
  players: Player[];
}

export function createGame(seed: number, playerCount = 1): GameState {
  const state: GameState = { tick: 0, seed, rng: seedRng(seed), grid: undefined!, players: [] };
  state.grid = generateGrid(state);
  for (let i = 0; i < playerCount; i++) {
    const [sx, sy] = SPAWNS[i];
    state.players.push({ id: i, x: sx * TILE, y: sy * TILE, facing: Dir.Down, alive: true });
  }
  return state;
}

/** Tile a player currently stands on (nearest centre). */
export function playerTile(p: Player): [number, number] {
  return [Math.round(p.x / TILE), Math.round(p.y / TILE)];
}
