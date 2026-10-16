import { Dir, GRID_H, GRID_W, Kind, SPAWNS, START_CHARGES, START_LIVES, START_RANGE, TILE } from './constants';
import { generateGrid, type Grid } from './grid';
import { placeGate, placeItems } from './items';
import { spawnMartians } from './martians';
import { seedRng } from './rng';

export interface Player {
  id: number;
  /** Position in sub-units (TILE per tile); a tile centre is tile * TILE. */
  x: number;
  y: number;
  facing: Dir;
  alive: boolean;
  lives: number;
  /** Ticks until a knocked-out player warps back in. */
  respawn: number;
  /** Ticks of spawn protection left. */
  shield: number;
  /** Beam range in tiles. */
  range: number;
  /** Charges this player may have on the field at once. */
  maxCharges: number;
  /** Jet Boots level, 0..MAX_BOOTS. */
  boots: number;
  /** Oxygen Vest ticks left. */
  vest: number;
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

export interface Martian {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  dir: Dir;
  alive: boolean;
}

export type Status = 'playing' | 'cleared' | 'game_over';

/** Things that happened this tick, for the view (sounds, effects). Not part of the state hash. */
export type SimEvent =
  | { type: 'charge_placed'; tx: number; ty: number }
  | { type: 'charge_exploded'; tx: number; ty: number }
  | { type: 'rock_broken'; tx: number; ty: number }
  | { type: 'item_picked'; id: number; item: number; tx: number; ty: number }
  | { type: 'item_destroyed'; tx: number; ty: number }
  | { type: 'freeze'; ticks: number }
  | { type: 'martian_killed'; id: number; tx: number; ty: number }
  | { type: 'player_died'; id: number; tx: number; ty: number }
  | { type: 'player_respawned'; id: number }
  | { type: 'gate_opened' }
  | { type: 'level_clear' }
  | { type: 'game_over' };

export interface GameOptions {
  players?: number;
  /** Gooplings to spawn (0 for an empty test arena). */
  martians?: number;
}

export interface GameState {
  tick: number;
  seed: number;
  rng: number;
  status: Status;
  grid: Grid;
  /** Power-up per tile (Item), hidden while the tile is still a rock. */
  items: Uint8Array;
  /** Tile index of the Warp Gate (hidden under a rock until it breaks), or -1. */
  gate: number;
  players: Player[];
  martians: Martian[];
  charges: Charge[];
  nextChargeId: number;
  /** Remaining beam ticks per tile (0 = no beam), indexed y * w + x. */
  beams: Uint8Array;
  /** Player id + 1 whose charge made the beam on each tile. */
  beamOwner: Uint8Array;
  /** Ticks left on a Freeze Pulse (all Martians stop). */
  freeze: number;
  events: SimEvent[];
}

export function createGame(seed: number, options: GameOptions = {}): GameState {
  const { players = 1, martians = 3 } = options;
  const state: GameState = {
    tick: 0,
    seed,
    rng: seedRng(seed),
    status: 'playing',
    grid: undefined!,
    items: new Uint8Array(GRID_W * GRID_H),
    gate: -1,
    players: [],
    martians: [],
    charges: [],
    nextChargeId: 1,
    beams: new Uint8Array(GRID_W * GRID_H),
    beamOwner: new Uint8Array(GRID_W * GRID_H),
    freeze: 0,
    events: [],
  };
  state.grid = generateGrid(state);
  placeItems(state);
  placeGate(state);
  for (let i = 0; i < players; i++) state.players.push(newPlayer(i));
  spawnMartians(state, Kind.Goopling, martians);
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
    lives: START_LIVES,
    respawn: 0,
    shield: 0,
    range: START_RANGE,
    maxCharges: START_CHARGES,
    boots: 0,
    vest: 0,
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

/** Tile a position currently stands on (nearest centre). */
export function playerTile(p: { x: number; y: number }): [number, number] {
  return [Math.round(p.x / TILE), Math.round(p.y / TILE)];
}
