import { Cell, COLLAPSE_EVERY, Item, TILE } from './constants';
import { forfeit } from './lives';
import type { GameState } from './state';

// Battle "Hurry Up": when the round clock hits 0 the arena collapses. One
// unbreakable block falls every COLLAPSE_EVERY ticks, spiralling clockwise from
// the top-left corner towards the centre. It crushes anyone under it (armor and
// shields don't help), destroys items and snuffs out charges.

const orders = new Map<string, number[]>();

/** Tile indices in falling order: the outer ring clockwise, then the next ring in. */
export function collapseOrder(w: number, h: number): number[] {
  const key = `${w}x${h}`;
  const cached = orders.get(key);
  if (cached) return cached;
  const out: number[] = [];
  let left = 0, top = 0, right = w - 1, bottom = h - 1;
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) out.push(top * w + x);
    for (let y = top + 1; y <= bottom; y++) out.push(y * w + right);
    if (top < bottom) for (let x = right - 1; x >= left; x--) out.push(bottom * w + x);
    if (left < right) for (let y = bottom - 1; y > top; y--) out.push(y * w + left);
    left++; top++; right--; bottom--;
  }
  orders.set(key, out);
  return out;
}

/** A body this close to a falling block's centre (on both axes) is under it. */
const CRUSH_REACH = (TILE * 7) / 10;

export function updateCollapse(state: GameState): void {
  if (state.mode !== 'battle' || state.timeLeft > 0 || state.status !== 'playing') return;
  if (state.collapseTicks++ % COLLAPSE_EVERY !== 0) return;
  const { grid } = state;
  const order = collapseOrder(grid.w, grid.h);
  // Skip tiles that are already solid (pillars): only open tiles and rocks fall.
  while (state.collapseNext < order.length && grid.cells[order[state.collapseNext]] === Cell.Pillar) state.collapseNext++;
  if (state.collapseNext >= order.length) return;
  const i = order[state.collapseNext++];
  const tx = i % grid.w, ty = Math.floor(i / grid.w);
  grid.cells[i] = Cell.Pillar;
  state.items[i] = Item.None;
  state.beams[i] = 0;
  state.charges = state.charges.filter((c) => c.tx !== tx || c.ty !== ty);
  state.events.push({ type: 'tile_collapsed', tx, ty });
  for (const p of state.players) {
    if (p.alive && Math.abs(p.x - tx * TILE) < CRUSH_REACH && Math.abs(p.y - ty * TILE) < CRUSH_REACH) forfeit(state, p);
  }
}

/** The next tiles to fall (for bots and the view's warning marks). */
export function nextCollapseTiles(state: GameState, count: number): number[] {
  const order = collapseOrder(state.grid.w, state.grid.h);
  const out: number[] = [];
  for (let k = state.collapseNext; k < order.length && out.length < count; k++) {
    if (state.grid.cells[order[k]] !== Cell.Pillar) out.push(order[k]);
  }
  return out;
}
