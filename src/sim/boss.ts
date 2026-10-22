import {
  BEAM_TICKS, BOSS_OWNER, BOSS_SPOUT, BOSS_TILE, BOSS_WAVES_SECONDS, BossKind, Cell, Dir, EVENT_WARNING_TICKS, Item, Kind,
  LevelEvent, TILE,
} from './constants';
import { warn } from './level_events';
import { nextInt } from './rng';
import { playerTile, type Boss, type GameState } from './state';

// Survival bosses on levels 5, 10 and 15. A boss sits on the centre tile, can
// never be hurt, and fires waves on a timer; it dies after its last interval,
// so outlasting it is the only way to win. Each wave is announced 3 s ahead.
//
// Every boss fires 3 waves, and each wait is half the one before it:
//   Goopling Hive (5):   3 Gooplings per wave; 44 -> 22 -> 11 s
//   Darkness Hive (10):  3 Gooplings + a Blackout; 40 -> 20 -> 10 s
//   Maze Master (15):    3 Gooplings + Maze Shift + a cross blast along the
//                        boss's whole row and column; 36 -> 18 -> 9 s

export function bossIntervals(kind: BossKind): number[] {
  return (BOSS_WAVES_SECONDS[kind] ?? []).map((s) => s * 60);
}

/** Makes the centre tile solid for the boss and clears rocks around it so Gooplings have room. */
export function setupBoss(state: GameState, kind: BossKind): void {
  const { grid } = state;
  const [bx, by] = BOSS_TILE;
  for (let i = 0; i < grid.cells.length; i++) {
    const x = i % grid.w, y = Math.floor(i / grid.w);
    if (Math.abs(x - bx) + Math.abs(y - by) <= 2 && grid.cells[i] === Cell.Rock) {
      grid.cells[i] = Cell.Empty;
      state.items[i] = Item.None;
    }
  }
  const tile = by * grid.w + bx;
  grid.cells[tile] = Cell.Pillar;
  state.items[tile] = Item.None;
  state.gate = -1; // no Warp Gate: surviving the boss clears the level
  // The first wave comes right after its 3 s warning.
  state.boss = { kind, tile, wave: 0, timer: EVENT_WARNING_TICKS + 1, alive: true };
}

export function bossWaveCount(boss: Boss): number {
  return bossIntervals(boss.kind).length;
}

/** Is a wave about to fire (the 3 s warning)? */
export function bossWarning(state: GameState): boolean {
  const b = state.boss;
  return !!b && b.alive && b.wave < bossWaveCount(b) && b.timer <= EVENT_WARNING_TICKS;
}

export function updateBoss(state: GameState): void {
  const b = state.boss;
  if (!b || !b.alive) return;
  const waves = bossIntervals(b.kind);
  b.timer--;
  if (b.wave < waves.length && b.timer === EVENT_WARNING_TICKS) {
    state.events.push({ type: 'boss_warning', wave: b.wave + 1 });
    // Event-driven parts of the wave share the regular 3 s warning and land on the same tick.
    if (b.kind === BossKind.DarknessHive) warn(state, LevelEvent.Blackout);
    if (b.kind === BossKind.MazeMaster) warn(state, LevelEvent.MazeShift);
  }
  if (b.timer > 0) return;
  if (b.wave < waves.length) {
    fireWave(state, b);
    b.timer = waves[b.wave];
    b.wave++;
  } else {
    b.alive = false;
    state.events.push({ type: 'boss_defeated' });
  }
}

function fireWave(state: GameState, b: Boss): void {
  state.events.push({ type: 'boss_wave', wave: b.wave + 1 });
  spoutGooplings(state, b, BOSS_SPOUT);
  if (b.kind === BossKind.MazeMaster) crossBlast(state, b);
}

/** Tiles of the Maze Master's cross blast: the boss's whole row and column, pillars excepted. */
export function crossTiles(state: GameState, b: Boss): number[] {
  const { grid } = state;
  const bx = b.tile % grid.w, by = Math.floor(b.tile / grid.w);
  const out: number[] = [];
  for (let x = 0; x < grid.w; x++) if (x !== bx) out.push(by * grid.w + x);
  for (let y = 0; y < grid.h; y++) if (y !== by) out.push(y * grid.w + bx);
  return out.filter((i) => grid.cells[i] !== Cell.Pillar);
}

/** Fires beams over the whole cross; rocks on it break. Gooplings ignore boss beams. */
function crossBlast(state: GameState, b: Boss): void {
  const tiles = crossTiles(state, b);
  for (const i of tiles) {
    if (state.grid.cells[i] === Cell.Rock) {
      state.grid.cells[i] = Cell.Empty;
      state.events.push({ type: 'rock_broken', tx: i % state.grid.w, ty: Math.floor(i / state.grid.w) });
    } else if (state.items[i] !== Item.None) {
      state.items[i] = Item.None;
      state.events.push({ type: 'item_destroyed', tx: i % state.grid.w, ty: Math.floor(i / state.grid.w) });
    }
    state.beams[i] = BEAM_TICKS;
    state.beamOwner[i] = BOSS_OWNER;
    state.beamRock[i] = 0;
  }
  state.events.push({ type: 'boss_cross', tiles });
}

/** Spawns Gooplings on open tiles near the boss, keeping clear of astronauts. */
function spoutGooplings(state: GameState, b: Boss, count: number): void {
  const { grid } = state;
  const bx = b.tile % grid.w, by = Math.floor(b.tile / grid.w);
  for (let radius = 2; radius <= 4; radius++) {
    const spots: number[] = [];
    for (let i = 0; i < grid.cells.length; i++) {
      const x = i % grid.w, y = Math.floor(i / grid.w);
      const d = Math.abs(x - bx) + Math.abs(y - by);
      if (d === 0 || d > radius || grid.cells[i] !== Cell.Empty) continue;
      if (state.charges.some((c) => c.tx === x && c.ty === y)) continue;
      if (state.players.some((p) => p.alive && Math.abs(playerTile(p)[0] - x) + Math.abs(playerTile(p)[1] - y) <= 1)) continue;
      spots.push(i);
    }
    if (spots.length < count && radius < 4) continue;
    let id = state.martians.reduce((n, m) => Math.max(n, m.id), 0);
    for (let n = 0; n < count && spots.length > 0; n++) {
      const i = spots.splice(nextInt(state, spots.length), 1)[0];
      state.martians.push({
        id: ++id, kind: Kind.Goopling, x: (i % grid.w) * TILE, y: Math.floor(i / grid.w) * TILE,
        dir: Dir.None, alive: true, timer: 0, hidden: false, built: 0,
      });
    }
    return;
  }
}
