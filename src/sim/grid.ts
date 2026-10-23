import { arenaLayout, arenaPillar, CLASSIC_ARENA } from './arenas';
import { Cell, GRID_H, GRID_W, SPAWNS, SPAWN_SAFE } from './constants';
import { nextInt, type RngState } from './rng';

/** The arena as a flat array, indexed y * w + x. */
export interface Grid {
  w: number;
  h: number;
  cells: Uint8Array;
}

/** Builds layout `arena` (arenas.ts; default classic) and rolls its rocks, one RNG draw per floor tile outside the spawn zones. */
export function generateGrid(rng: RngState, arena = CLASSIC_ARENA): Grid {
  const cells = new Uint8Array(GRID_W * GRID_H);
  const density = arenaLayout(arena).rockDensity;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      cells[y * GRID_W + x] = rollCell(arena, density, x, y, rng);
    }
  }
  return { w: GRID_W, h: GRID_H, cells };
}

function rollCell(arena: number, density: number, x: number, y: number, rng: RngState): Cell {
  if (arenaPillar(arena, x, y)) return Cell.Pillar;
  if (inSpawnZone(x, y)) return Cell.Empty;
  return nextInt(rng, 100) < density ? Cell.Rock : Cell.Empty;
}

export function inSpawnZone(x: number, y: number): boolean {
  return SPAWNS.some(([sx, sy]) => Math.abs(x - sx) < SPAWN_SAFE && Math.abs(y - sy) < SPAWN_SAFE);
}

export function inBounds(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.w && y < g.h;
}

/** Out-of-bounds tiles read as Pillar, so callers need no separate bounds check. */
export function cellAt(g: Grid, x: number, y: number): Cell {
  return inBounds(g, x, y) ? (g.cells[y * g.w + x] as Cell) : Cell.Pillar;
}

export function isWalkable(g: Grid, x: number, y: number): boolean {
  return cellAt(g, x, y) === Cell.Empty;
}
