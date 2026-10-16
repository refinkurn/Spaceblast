import { Cell, DIR_DX, DIR_DY, Dir, FUSE_TICKS } from './constants';
import { cellAt, inBounds } from './grid';
import type { Charge, GameState } from './state';

// Which tiles are about to be hit by a beam, and when. Used by the battle bot
// and by Martians that dodge (the Sniffer).

/** Danger value for a tile no charge threatens. */
export const SAFE = -1;
const DIRS = [Dir.Up, Dir.Down, Dir.Left, Dir.Right] as const;

/** Calls fn for every tile a charge at (x, y) with `range` would reach, rock tiles included. */
export function forEachBeamTile(state: GameState, x: number, y: number, range: number, fn: (bx: number, by: number, cell: number) => void) {
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
 * Accounts for chain reactions. `extra` adds a hypothetical new charge;
 * `only` limits which charges count (e.g. the ones a Martian has noticed).
 */
export function dangerMap(
  state: GameState,
  extra?: { tx: number; ty: number; range: number },
  only?: (c: Charge) => boolean,
): Int16Array {
  const { w, h } = state.grid;
  const danger = new Int16Array(w * h).fill(SAFE);
  state.beams.forEach((b, i) => { if (b > 0) danger[i] = 0; });
  const charges = state.charges.filter((c) => !only || only(c)).map((c) => ({ tx: c.tx, ty: c.ty, range: c.range, fuse: c.fuse }));
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
 * First step towards the nearest tile no noticed charge threatens, reachable
 * before the tiles on the way blow. Returns Dir.None when no such route exists.
 */
export function escapeStep(
  state: GameState,
  tx: number,
  ty: number,
  ticksPerTile: number,
  danger: Int16Array,
  canEnter: (x: number, y: number) => boolean,
): Dir {
  const { w, h } = state.grid;
  const first = new Int8Array(w * h).fill(-1);
  const depth = new Int16Array(w * h).fill(-1);
  const start = ty * w + tx;
  depth[start] = 0;
  const queue = [start];
  while (queue.length > 0) {
    const i = queue.shift()!;
    const x = i % w, y = Math.floor(i / w);
    for (const d of DIRS) {
      const nx = x + DIR_DX[d], ny = y + DIR_DY[d];
      const ni = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || depth[ni] !== -1 || !canEnter(nx, ny)) continue;
      const t = danger[ni];
      const arrive = (depth[i] + 1) * ticksPerTile;
      if (t === 0 || (t !== SAFE && t <= arrive)) continue;
      depth[ni] = depth[i] + 1;
      first[ni] = depth[i] === 0 ? d : first[i];
      if (t === SAFE) return first[ni] as Dir;
      queue.push(ni);
    }
  }
  return Dir.None;
}
