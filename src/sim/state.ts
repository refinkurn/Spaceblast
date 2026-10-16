import { Dir, GRID_H, GRID_W, SPAWNS, START_CHARGES, START_RANGE, TILE } from './constants';
import { generateGrid, type Grid } from './grid';
import { seedRng } from './rng';

export interface Player {
  id: number;
  /** Position in sub-units (TILE per tile); a tile centre is tile * TILE. */
  x: number;
  y: number;
  facing: Dir;
  alive: boolean;
  /** Ticks until a knocked-out player warps back in. */
  respawn: number;
  /** Beam range in tiles. */
  range: number;
  /** Charges this player may have on the field at once. */
  maxCharges: number;
  /** Place button state last tick, so holding it places only one charge. */
  placeHeld: boolean;
  /** Charges this player is still standing on and may walk off. */
  passable: number[];
}

export interface Charge {
  id: number;
  owner: number;
  tx: number;
  ty: number;
  /** Ticks until detonation. */
  fuse: number;
  range: number;
}

/** Things that happened this tick, for the view (sounds, effects). Not part of the state hash. */
export type SimEvent =
  | { type: 'charge_placed'; tx: number; ty: number }
  | { type: 'charge_exploded'; tx: number; ty: number }
  | { type: 'rock_broken'; tx: number; ty: number }
  | { type: 'player_died'; id: number; tx: number; ty: number }
  | { type: 'player_respawned'; id: number };

export interface GameState {
  tick: number;
  seed: number;
  rng: number;
  grid: Grid;
  players: Player[];
  charges: Charge[];
  nextChargeId: number;
  /** Remaining beam ticks per tile (0 = no beam), indexed y * w + x. */
  beams: Uint8Array;
  events: SimEvent[];
}

export function createGame(seed: number, playerCount = 1): GameState {
  const state: GameState = {
    tick: 0,
    seed,
    rng: seedRng(seed),
    grid: undefined!,
    players: [],
    charges: [],
    nextChargeId: 1,
    beams: new Uint8Array(GRID_W * GRID_H),
    events: [],
  };
  state.grid = generateGrid(state);
  for (let i = 0; i < playerCount; i++) state.players.push(newPlayer(i));
  return state;
}

function newPlayer(id: number): Player {
  const [sx, sy] = SPAWNS[id];
  return {
    id,
    x: sx * TILE,
    y: sy * TILE,
    facing: Dir.Down,
    alive: true,
    respawn: 0,
    range: START_RANGE,
    maxCharges: START_CHARGES,
    placeHeld: false,
    passable: [],
  };
}

/** Puts a player back on its spawn tile (keeps its power-ups). */
export function warpToSpawn(p: Player): void {
  const [sx, sy] = SPAWNS[p.id];
  p.x = sx * TILE;
  p.y = sy * TILE;
  p.facing = Dir.Down;
  p.passable = [];
}

/** Tile a player currently stands on (nearest centre). */
export function playerTile(p: Player): [number, number] {
  return [Math.round(p.x / TILE), Math.round(p.y / TILE)];
}
