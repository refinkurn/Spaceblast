import { describe, expect, it } from 'vitest';
import { ARENAS, ARENA_IDS, arenaPillar, resolveArena } from './arenas';
import { BOSS_TILE, BossKind, Cell, DIR_DX, DIR_DY, GRID_H, GRID_W, SPAWNS } from './constants';
import { inSpawnZone } from './grid';
import { LEVEL_COUNT, levelSpec, sectorOf } from './levels';
import { hashState } from './sim';
import { createGame } from './state';

// Hard constraints of every arena layout (arenas.ts), on the bare layout and
// over many seeds of real games built on it.

const SEEDS = 150;
const ALL = ARENAS.map((a) => a.id);
const pillarsOf = (id: number) => {
  const out: number[] = [];
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (arenaPillar(id, x, y)) out.push(y * GRID_W + x);
  return out;
};
const neighbours = (x: number, y: number) =>
  [1, 2, 3, 4].map((d) => [x + DIR_DX[d], y + DIR_DY[d]] as const).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < GRID_W && ny < GRID_H);

/** Tiles reachable from (sx, sy) through every tile `open` allows. */
function reach(open: (i: number) => boolean, sx: number, sy: number): Set<number> {
  const seen = new Set([sy * GRID_W + sx]);
  const queue = [sy * GRID_W + sx];
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (const [nx, ny] of neighbours(i % GRID_W, Math.floor(i / GRID_W))) {
      const n = ny * GRID_W + nx;
      if (!seen.has(n) && open(n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

describe('arena layouts', () => {
  it('are 13x11 grids of # and ., indexed by id', () => {
    ARENAS.forEach((a, i) => {
      expect(a.id).toBe(i);
      expect(a.rows).toHaveLength(GRID_H);
      for (const row of a.rows) expect(row).toMatch(new RegExp(`^[#.]{${GRID_W}}$`));
      expect(a.rockDensity).toBeGreaterThanOrEqual(40);
      expect(a.rockDensity).toBeLessThanOrEqual(70);
    });
    expect(ARENA_IDS).toEqual([1, 2, 3, 4]);
    expect(ARENAS.map((a) => a.rockDensity)).toEqual([60, 50, 60, 55, 55]);
  });

  it('classic (0) is the original odd/odd grid', () => {
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) expect(arenaPillar(0, x, y)).toBe(x % 2 === 1 && y % 2 === 1);
  });

  it('are different from each other', () => {
    const keys = ALL.map((id) => pillarsOf(id).join(','));
    expect(new Set(keys).size).toBe(ALL.length);
  });

  it.each(ALL)('layout %i is mirror-symmetric on both axes', (id) => {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        expect(arenaPillar(id, GRID_W - 1 - x, y), `${x},${y}`).toBe(arenaPillar(id, x, y));
        expect(arenaPillar(id, x, GRID_H - 1 - y), `${x},${y}`).toBe(arenaPillar(id, x, y));
      }
    }
  });

  it.each(ALL)('layout %i keeps the pillar count within 25%% of classic and has no 2x2 pillar block', (id) => {
    const n = pillarsOf(id).length;
    expect(n).toBeGreaterThanOrEqual(Math.ceil(30 * 0.75));
    expect(n).toBeLessThanOrEqual(Math.floor(30 * 1.25));
    for (let y = 0; y < GRID_H - 1; y++) {
      for (let x = 0; x < GRID_W - 1; x++) {
        const block = arenaPillar(id, x, y) && arenaPillar(id, x + 1, y) && arenaPillar(id, x, y + 1) && arenaPillar(id, x + 1, y + 1);
        expect(block, `2x2 at ${x},${y}`).toBe(false);
      }
    }
  });

  it.each(ALL)('layout %i: each spawn and its neighbours are free (2 ways out), its zone is pillar-light', (id) => {
    for (const [sx, sy] of SPAWNS) {
      expect(arenaPillar(id, sx, sy)).toBe(false);
      const free = neighbours(sx, sy).filter(([x, y]) => !arenaPillar(id, x, y));
      expect(free.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(ARENA_IDS)('layout %i never puts a pillar on BOSS_TILE or its 4 neighbours', (id) => {
    const [bx, by] = BOSS_TILE;
    expect(arenaPillar(id, bx, by)).toBe(false);
    for (const [x, y] of neighbours(bx, by)) expect(arenaPillar(id, x, y), `${x},${y}`).toBe(false);
  });

  it.each(ALL)('layout %i: every non-pillar tile reaches every spawn (rocks can be blasted)', (id) => {
    const total = GRID_W * GRID_H - pillarsOf(id).length;
    for (const [sx, sy] of SPAWNS) {
      expect(reach((i) => !arenaPillar(id, i % GRID_W, Math.floor(i / GRID_W)), sx, sy).size).toBe(total);
    }
  });
});

describe('games built on a layout', () => {
  it.each(ALL)('layout %i over many seeds: pillars match, spawn zones rock-free, all connected, a way out of a first charge', (id) => {
    const pillars = pillarsOf(id);
    let rocks = 0, floor = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = createGame(seed, { mode: 'battle', players: 4, arena: id });
      expect(g.arena).toBe(id);
      const { cells } = g.grid;
      cells.forEach((c, i) => {
        const x = i % GRID_W, y = Math.floor(i / GRID_W);
        expect(c === Cell.Pillar, `seed ${seed} tile ${x},${y}`).toBe(pillars.includes(i));
        if (inSpawnZone(x, y)) expect(c).not.toBe(Cell.Rock);
        else if (c !== Cell.Pillar) { floor++; if (c === Cell.Rock) rocks++; }
      });
      for (const [sx, sy] of SPAWNS) {
        expect(reach((i) => cells[i] !== Cell.Pillar, sx, sy).size).toBe(GRID_W * GRID_H - pillars.length);
        // Charge on the spawn (range 1): some open tile the walk reaches is out of the blast.
        const walk = reach((i) => cells[i] === Cell.Empty, sx, sy);
        const safe = [...walk].some((i) => {
          const x = i % GRID_W, y = Math.floor(i / GRID_W);
          return Math.abs(x - sx) + Math.abs(y - sy) > 1;
        });
        expect(safe, `seed ${seed} spawn ${sx},${sy}`).toBe(true);
      }
    }
    // Rock share close to the layout's density.
    expect(Math.abs((rocks * 100) / floor - ARENAS[id].rockDensity)).toBeLessThan(3);
  });

  it.each(ARENA_IDS)('layout %i with a boss on the centre: still all connected', (id) => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = createGame(seed, { boss: BossKind.MazeMaster, arena: id });
      const { cells } = g.grid;
      const solid = cells.filter((c) => c === Cell.Pillar).length;
      expect(solid).toBe(pillarsOf(id).length + 1);
      for (const [sx, sy] of SPAWNS) expect(reach((i) => cells[i] !== Cell.Pillar, sx, sy).size).toBe(GRID_W * GRID_H - solid);
      // The boss's 4 neighbours stay open floor for its Gooplings.
      const [bx, by] = BOSS_TILE;
      for (const [x, y] of neighbours(bx, by)) expect(cells[y * GRID_W + x]).toBe(Cell.Empty);
    }
  });

  it('defaults to classic, so old games and tests are unchanged', () => {
    const g = createGame(7);
    expect(g.arena).toBe(0);
    expect(createGame(7, { arena: 0 }).grid.cells).toEqual(g.grid.cells);
    expect(createGame(7, { arena: 9 }).arena).toBe(0);
    expect(createGame(7, { arena: -1 }).arena).toBe(0);
  });

  it('puts the arena id in the state hash', () => {
    const a = createGame(5, { mode: 'battle', arena: 2 });
    const b = createGame(5, { mode: 'battle', arena: 2 });
    expect(hashState(a)).toBe(hashState(b));
    b.arena = 3;
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('random arena', () => {
  it('picks one of 1-4 from the seed alone, the same every time, and uses all four', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const id = resolveArena('random', seed);
      expect(ARENA_IDS).toContain(id);
      expect(resolveArena('random', seed)).toBe(id);
      seen.add(id);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('builds exactly the game of the layout it picked (the game RNG is not used to pick)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = createGame(seed, { mode: 'battle', players: 4, arena: 'random' });
      const fixed = createGame(seed, { mode: 'battle', players: 4, arena: resolveArena('random', seed) });
      expect(hashState(r)).toBe(hashState(fixed));
    }
  });
});

describe('story arenas', () => {
  it('every level uses its sector layout', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) expect(levelSpec(level).arena).toBe(sectorOf(level));
  });

  it('every level spawns its whole roster on its layout', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const spec = levelSpec(level);
      for (let seed = 1; seed <= 30; seed++) {
        const g = createGame(seed, { roster: spec.roster, rules: spec.rules, boss: spec.boss, rival: spec.rival, arena: spec.arena });
        expect(g.martians.map((m) => m.kind), `level ${level} seed ${seed}`).toEqual(spec.roster);
        if (!spec.boss && !spec.rival) expect(g.grid.cells[g.gate], `level ${level} seed ${seed}`).toBe(Cell.Rock);
      }
    }
  });
});
