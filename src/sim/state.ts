import { Dir, GRID_H, GRID_W, Kind, ROUND_TICKS, SPAWNS, START_CHARGES, START_LIVES, START_RANGE, TILE } from './constants';
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
  /** Kind-specific countdown (Phaser phases, Builder rocks). */
  timer: number;
  /** Phaser in its burrow: invisible, cannot bite or be hit. */
  hidden: boolean;
  /** Builder: rocks placed so far. */
  built: number;
}

/** A Phaser portal pair: Martians stepping on tile `from` come out at `to`. */
export interface Portal {
  from: number;
  to: number;
  ticks: number;
}

export type Status = 'playing' | 'cleared' | 'game_over' | 'round_over';

/** Survival: clear levels against Martians. Battle: last astronaut standing. */
export type Mode = 'survival' | 'battle';

/** Things that happened this tick, for the view (sounds, effects). Not part of the state hash. */
export type SimEvent =
  | { type: 'charge_placed'; tx: number; ty: number }
  | { type: 'charge_exploded'; tx: number; ty: number }
  | { type: 'rock_broken'; tx: number; ty: number }
  | { type: 'item_picked'; id: number; item: number; tx: number; ty: number }
  | { type: 'item_destroyed'; tx: number; ty: number }
  | { type: 'freeze'; ticks: number }
  | { type: 'martian_killed'; id: number; tx: number; ty: number }
  | { type: 'phaser_jumped'; id: number; from: number; to: number }
  | { type: 'rock_built'; tx: number; ty: number }
  | { type: 'player_died'; id: number; tx: number; ty: number }
  | { type: 'player_respawned'; id: number }
  | { type: 'gate_opened' }
  | { type: 'level_clear' }
  | { type: 'game_over' }
  | { type: 'round_over'; winner: number };

export interface GameOptions {
  mode?: Mode;
  /** Defaults: 1 in survival, 2 in battle. */
  players?: number;
  /** Gooplings to spawn in survival (0 for an empty test arena). */
  martians?: number;
  /** Exact Martian kinds to spawn in survival; overrides `martians`. */
  roster?: Kind[];
}

export interface GameState {
  tick: number;
  seed: number;
  rng: number;
  mode: Mode;
  status: Status;
  /** Battle: id of the round winner, or -1 for a draw. */
  winner: number;
  /** Battle: ticks left in the round. */
  timeLeft: number;
  grid: Grid;
  /** Power-up per tile (Item), hidden while the tile is still a rock. */
  items: Uint8Array;
  /** Tile index of the Warp Gate (hidden under a rock until it breaks), or -1. */
  gate: number;
  players: Player[];
  martians: Martian[];
  portals: Portal[];
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
  const mode = options.mode ?? 'survival';
  const battle = mode === 'battle';
  const players = options.players ?? (battle ? 2 : 1);
  const roster: Kind[] = battle ? [] : (options.roster ?? Array<Kind>(options.martians ?? 3).fill(Kind.Goopling));
  const state: GameState = {
    tick: 0,
    seed,
    rng: seedRng(seed),
    mode,
    status: 'playing',
    winner: -1,
    timeLeft: battle ? ROUND_TICKS : 0,
    grid: undefined!,
    items: new Uint8Array(GRID_W * GRID_H),
    gate: -1,
    players: [],
    martians: [],
    portals: [],
    charges: [],
    nextChargeId: 1,
    beams: new Uint8Array(GRID_W * GRID_H),
    beamOwner: new Uint8Array(GRID_W * GRID_H),
    freeze: 0,
    events: [],
  };
  state.grid = generateGrid(state);
  placeItems(state);
  if (!battle) placeGate(state);
  // One life per round in battle; survival keeps START_LIVES.
  for (let i = 0; i < players; i++) state.players.push(newPlayer(i, battle ? 1 : START_LIVES));
  spawnMartians(state, roster);
  return state;
}

function newPlayer(id: number, lives: number): Player {
  const [sx, sy] = SPAWNS[id];
  return {
    id,
    x: sx * TILE,
    y: sy * TILE,
    facing: Dir.Down,
    alive: true,
    lives,
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
