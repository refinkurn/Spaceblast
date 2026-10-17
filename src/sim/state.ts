import { BossKind, Dir, FIRST_EVENT_TICKS, GRID_H, GRID_W, Kind, LevelEvent, ROUND_TICKS, SPAWNS, START_CHARGES, START_LIVES, START_RANGE, TILE } from './constants';
import { setupBoss } from './boss';
import { NO_EVENTS, type LevelRules } from './levels';
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
  /** Speed Boost steps, 0..MAX_BOOTS (the item is JetBoots in code). */
  boots: number;
  /** Oxygen Vest armor points: each absorbs one hit, 0..MAX_ARMOR. */
  armor: number;
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

/** A stationary boss on the centre tile; it cannot be hurt, the level is won by outlasting its waves. */
export interface Boss {
  kind: BossKind;
  /** Tile index of the boss (made solid for the fight). */
  tile: number;
  /** Waves fired so far. */
  wave: number;
  /** Ticks until the next wave fires, or until the boss dies after the last one. */
  timer: number;
  alive: boolean;
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
  | { type: 'event_warning'; event: LevelEvent }
  | { type: 'maze_shift'; removed: number[]; added: number[] }
  | { type: 'blackout_start' }
  | { type: 'blackout_end' }
  | { type: 'gate_moved'; hidden: boolean }
  | { type: 'armor_hit'; id: number }
  | { type: 'boss_warning'; wave: number }
  | { type: 'boss_wave'; wave: number }
  | { type: 'boss_cross'; tiles: number[] }
  | { type: 'boss_defeated' }
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
  /** Survival level events (Maze Shift, wandering gate, Blackout). */
  rules?: LevelRules;
  /** Survival boss on the centre tile (levels 5, 10, 15). */
  boss?: BossKind;
  /** Survival duel: player 1 is the Renegade Pilot (level 20). */
  rival?: boolean;
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
  /** Player id + 1 whose charge made the beam on each tile (BOSS_OWNER for boss blasts). */
  beamOwner: Uint8Array;
  /** 1 where the beam came from blasting a rock: it clears the tile but does not hurt Martians. */
  beamRock: Uint8Array;
  boss: Boss | null;
  /** Level 20 duel: player 1 is the rival, and defeating it clears the level. */
  rival: boolean;
  /** Ticks left on a Freeze Pulse (all Martians stop). */
  freeze: number;
  rules: LevelRules;
  /** The event being announced or running, or None. */
  event: LevelEvent;
  /** Ticks left in the current event's warning, then in the event itself. */
  eventWarning: number;
  eventActive: number;
  /** Ticks until the next event's warning starts. */
  nextEvent: number;
  /** Maze Shift plan, shown during the warning: tiles losing and gaining a rock. */
  shiftRemove: number[];
  shiftAdd: number[];
  /** Ticks the revealed gate has waited without anyone stepping on it. */
  gateWait: number;
  events: SimEvent[];
}

export function createGame(seed: number, options: GameOptions = {}): GameState {
  const mode = options.mode ?? 'survival';
  const battle = mode === 'battle';
  const rival = !battle && (options.rival ?? false);
  const bossKind = battle || rival ? BossKind.None : (options.boss ?? BossKind.None);
  const players = options.players ?? (battle || rival ? 2 : 1);
  const roster: Kind[] = battle || rival || bossKind ? [] : (options.roster ?? Array<Kind>(options.martians ?? 3).fill(Kind.Goopling));
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
    beamRock: new Uint8Array(GRID_W * GRID_H),
    boss: null,
    rival,
    freeze: 0,
    rules: battle ? NO_EVENTS : (options.rules ?? NO_EVENTS),
    event: LevelEvent.None,
    eventWarning: 0,
    eventActive: 0,
    nextEvent: FIRST_EVENT_TICKS,
    shiftRemove: [],
    shiftAdd: [],
    gateWait: 0,
    events: [],
  };
  state.grid = generateGrid(state);
  placeItems(state);
  if (bossKind) setupBoss(state, bossKind);
  else if (!battle && !rival) placeGate(state);
  // One life per round in battle and for the duel's rival; survival keeps START_LIVES.
  for (let i = 0; i < players; i++) state.players.push(newPlayer(i, battle || (rival && i > 0) ? 1 : START_LIVES));
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
    armor: 0,
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
