import { canWalk } from '../sim/charges';
import { Cell, DIR_DX, DIR_DY, Dir, FUSE_TICKS, Item, TILE } from '../sim/constants';
import type { PlayerCommand } from '../sim/command';
import { cellAt, inBounds } from '../sim/grid';
import { itemAt, playerSpeed } from '../sim/items';
import { nextInt, seedRng, type RngState } from '../sim/rng';
import { playerTile, type GameState, type Player } from '../sim/state';

// A simple battle bot, used as an input source like the keyboard.
// Each tick it: 1) escapes if its tile is about to be hit, 2) places a charge
// when that would hit a rock or the opponent AND it can still escape,
// 3) otherwise walks to a power-up, a useful spot near rocks, or the opponent.
// It reads the state but never changes it; its own RNG keeps replays exact.

const DIRS = [Dir.Up, Dir.Down, Dir.Left, Dir.Right] as const;
const SAFE = -1;

interface Path {
  first: Dir;
  length: number;
}

export class Bot {
  private rng: RngState;
  /** Ticks before the bot may consider placing again (keeps it beatable). */
  private cooldown = 30;
  private wasPlacing = false;

  constructor(readonly id: number, seed: number) {
    this.rng = { rng: seedRng(seed ^ (0x5bd1e995 * (id + 1))) };
  }

  think(state: GameState): PlayerCommand {
    const me = state.players[this.id];
    const none: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };
    if (!me?.alive) return none;
    if (this.cooldown > 0) this.cooldown--;

    const danger = dangerMap(state);
    const [tx, ty] = playerTile(me);
    const w = state.grid.w;
    const perTile = Math.ceil(TILE / playerSpeed(me));
    // Standing still means steering back to the tile centre: with no input the
    // movement rules would glide on to the next tile, maybe into a blast.
    const stay = { ...none, dir: toCentre(me) };

    // 1) Escape if any tile the body overlaps is threatened.
    if (overlapped(me).some(([x, y]) => danger[y * w + x] !== SAFE)) {
      const out = search(state, me, danger, perTile, (x, y) => danger[y * w + x] === SAFE, true);
      return out && out.length > 0 ? { ...none, dir: out.first } : stay;
    }

    // 2) Place a charge if it pays off and there is a way out.
    // Release the button for a tick after pressing, so the next press counts.
    if (this.wasPlacing) {
      this.wasPlacing = false;
    } else if (this.cooldown === 0 && this.ownCharges(state) < me.maxCharges && this.worthPlacing(state, me, tx, ty)) {
      const after = dangerMap(state, { tx, ty, range: me.range });
      const out = search(state, me, after, perTile, (x, y) => after[y * w + x] === SAFE, true);
      if (out && out.length * perTile < FUSE_TICKS - 30) {
        this.cooldown = 20 + nextInt(this.rng, 40);
        this.wasPlacing = true;
        return { ...stay, place: true };
      }
    }

    // 3) Go somewhere useful without walking into danger.
    const foe = state.players.find((p) => p.id !== this.id && p.alive);
    const goal = (x: number, y: number) =>
      itemAt(state, x, y) !== Item.None ||
      (this.cooldown < 10 && this.ownCharges(state) < me.maxCharges && this.worthPlacing(state, me, x, y));
    const path = search(state, me, danger, perTile, goal, false);
    if (path && path.length > 0) return { ...none, dir: path.first };
    if (foe) {
      const [fx, fy] = playerTile(foe);
      const chase = search(state, me, danger, perTile, (x, y) => Math.abs(x - fx) + Math.abs(y - fy) <= 1, false);
      if (chase && chase.length > 0) return { ...none, dir: chase.first };
    }
    return stay;
  }

  private ownCharges(state: GameState): number {
    return state.charges.filter((c) => c.owner === this.id).length;
  }

  /** Would a charge on (x, y) hit a rock or a rival astronaut? */
  private worthPlacing(state: GameState, me: Player, x: number, y: number): boolean {
    if (state.charges.some((c) => c.tx === x && c.ty === y)) return false;
    let hit = false;
    forEachBeamTile(state, x, y, me.range, (bx, by, cell) => {
      if (cell === Cell.Rock) hit = true;
      for (const p of state.players) {
        if (p.id === me.id || !p.alive) continue;
        const [px, py] = playerTile(p);
        if (px === bx && py === by) hit = true;
      }
    });
    return hit;
  }
}

/** Tiles the player's body overlaps (one, or two when between tiles). */
function overlapped(p: Player): [number, number][] {
  const xs = [Math.floor(p.x / TILE), Math.ceil(p.x / TILE)];
  const ys = [Math.floor(p.y / TILE), Math.ceil(p.y / TILE)];
  const out: [number, number][] = [];
  for (const x of new Set(xs)) for (const y of new Set(ys)) out.push([x, y]);
  return out;
}

/** Direction back to the centre of the current tile, or None when centred. */
function toCentre(p: Player): Dir {
  const [tx, ty] = playerTile(p);
  if (p.x !== tx * TILE) return p.x < tx * TILE ? Dir.Right : Dir.Left;
  if (p.y !== ty * TILE) return p.y < ty * TILE ? Dir.Down : Dir.Up;
  return Dir.None;
}

/** Calls fn for every tile a charge at (x, y) with `range` would reach, rock tiles included. */
function forEachBeamTile(state: GameState, x: number, y: number, range: number, fn: (bx: number, by: number, cell: number) => void) {
  fn(x, y, Cell.Empty);
  for (const d of DIRS) {
    for (let r = 1; r <= range; r++) {
      const bx = x + DIR_DX[d] * r, by = y + DIR_DY[d] * r;
      if (!inBounds(state.grid, bx, by)) break;
      const cell = cellAt(state.grid, bx, by);
      if (cell === Cell.Pillar) break;
      fn(bx, by, cell);
      if (cell === Cell.Rock) break;
    }
  }
}

/**
 * Ticks until each tile is hit by a beam: 0 = beam now, SAFE = not threatened.
 * Accounts for chain reactions. `extra` adds a hypothetical new charge.
 */
export function dangerMap(state: GameState, extra?: { tx: number; ty: number; range: number }): Int16Array {
  const { w, h } = state.grid;
  const danger = new Int16Array(w * h).fill(SAFE);
  state.beams.forEach((b, i) => { if (b > 0) danger[i] = 0; });
  const charges = state.charges.map((c) => ({ tx: c.tx, ty: c.ty, range: c.range, fuse: c.fuse }));
  if (extra) charges.push({ ...extra, fuse: FUSE_TICKS });
  // A few passes let chain reactions shorten fuses that a nearer blast will trigger.
  for (let pass = 0; pass < 3; pass++) {
    for (const c of charges) {
      const here = danger[c.ty * w + c.tx];
      if (here !== SAFE && here < c.fuse) c.fuse = here;
      forEachBeamTile(state, c.tx, c.ty, c.range, (bx, by) => {
        const i = by * w + bx;
        if (danger[i] === SAFE || danger[i] > c.fuse) danger[i] = c.fuse;
      });
    }
  }
  return danger;
}

/**
 * Breadth-first search from the bot's tile to the nearest tile matching `goal`.
 * Never steps into a live beam. When `escaping`, threatened tiles may be crossed
 * if the bot gets through before they blow; otherwise they are avoided.
 */
function search(
  state: GameState,
  me: Player,
  danger: Int16Array,
  perTile: number,
  goal: (x: number, y: number) => boolean,
  escaping: boolean,
): Path | null {
  const { w, h } = state.grid;
  const [sx, sy] = playerTile(me);
  const first = new Int8Array(w * h).fill(-1);
  const depth = new Int16Array(w * h).fill(-1);
  const queue = [sy * w + sx];
  depth[sy * w + sx] = 0;
  if (goal(sx, sy)) return { first: Dir.None, length: 0 };
  while (queue.length > 0) {
    const i = queue.shift()!;
    const x = i % w, y = Math.floor(i / w);
    for (const d of DIRS) {
      const nx = x + DIR_DX[d], ny = y + DIR_DY[d];
      const ni = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || depth[ni] !== -1) continue;
      if (!canWalk(state, me, nx, ny)) continue;
      const arrive = (depth[i] + 1) * perTile;
      const t = danger[ni];
      if (t === 0) continue;
      if (t !== SAFE && (!escaping || t <= arrive + 12)) continue;
      depth[ni] = depth[i] + 1;
      first[ni] = depth[i] === 0 ? d : first[i];
      if (goal(nx, ny)) return { first: first[ni] as Dir, length: depth[ni] };
      queue.push(ni);
    }
  }
  return null;
}
