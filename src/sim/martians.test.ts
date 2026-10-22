import { describe, expect, it } from 'vitest';
import {
  BUILD_EVERY_TICKS, BUILDER_MAX_ROCKS, Cell, Dir, FUSE_TICKS, GRID_W, Kind, PHASER_HIDE_TICKS, PHASER_WANDER_TICKS, TILE,
} from './constants';
import type { PlayerCommand } from './command';
import { LEVEL_COUNT, levelRoster, levelSpec, sectorOf } from './levels';
import { seedRng } from './rng';
import { hashState, step } from './sim';
import { createGame, type GameState, type Martian } from './state';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };
const run = (g: GameState, ticks: number) => { for (let i = 0; i < ticks; i++) step(g, [idle]); };

/** Empty arena (pillars only) with a seeded RNG; the player is parked out of reach. */
function arena(seed = 1): GameState {
  const g = createGame(1, { martians: 0 });
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  g.items.fill(0);
  g.gate = -1;
  g.rng = seedRng(seed);
  g.players[0].shield = 1e6;
  return g;
}

function add(g: GameState, kind: Kind, tx: number, ty: number, extra: Partial<Martian> = {}): Martian {
  const m: Martian = { id: g.martians.length + 1, kind, x: tx * TILE, y: ty * TILE, dir: Dir.None, alive: true, timer: 0, hidden: false, built: 0, ...extra };
  g.martians.push(m);
  return m;
}

describe('level roster', () => {
  it('follows the sector plan: one new species per sector (Goopling 1, Sniffer 6, Phaser 11, Builder 16)', () => {
    expect(levelRoster(1)).toEqual([Kind.Goopling, Kind.Goopling]); // the tutorial level: two slow Gooplings
    const firstLevel = (kind: Kind) => {
      for (let n = 1; n <= LEVEL_COUNT; n++) if (levelRoster(n).includes(kind)) return n;
      return -1;
    };
    expect(firstLevel(Kind.Goopling)).toBe(1);
    expect(firstLevel(Kind.Sniffer)).toBe(6);
    expect(firstLevel(Kind.Phaser)).toBe(11);
    expect(firstLevel(Kind.Builder)).toBe(16);
    for (const boss of [5, 10, 15, 20]) expect(levelRoster(boss)).toEqual([]); // bosses bring their own
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      if (level % 5 === 0) continue;
      const roster = levelRoster(level);
      expect(roster.length).toBeGreaterThanOrEqual(2);
      expect(roster.length).toBeLessThanOrEqual(9);
      expect(levelSpec(level).sector).toBe(sectorOf(level));
    }
  });

  it('spawns the roster it is given', () => {
    const g = createGame(4, { roster: [Kind.Sniffer, Kind.Phaser, Kind.Builder] });
    expect(g.martians.map((m) => m.kind)).toEqual([Kind.Sniffer, Kind.Phaser, Kind.Builder]);
  });
});

describe('Sniffer', () => {
  /**
   * A Martian in a one-row corridor, 2 tiles left of a charge it has had time
   * to notice (range 3, 70 ticks left). Only going left right away is safe.
   */
  function survives(kind: Kind, seed: number): boolean {
    const g = arena(seed);
    for (const y of [3, 5]) for (let x = 0; x < GRID_W; x++) if (g.grid.cells[y * GRID_W + x] === Cell.Empty) g.grid.cells[y * GRID_W + x] = Cell.Rock;
    const m = add(g, kind, 4, 4);
    g.charges.push({ id: 99, owner: 0, tx: 6, ty: 4, fuse: 70, range: 3 });
    expect(FUSE_TICKS - 70).toBeGreaterThan(40); // old enough to be noticed
    run(g, 75);
    return m.alive;
  }

  it('dodges blasts far more often than a Goopling', () => {
    let sniffer = 0, goopling = 0;
    for (let seed = 1; seed <= 40; seed++) {
      if (survives(Kind.Sniffer, seed)) sniffer++;
      if (survives(Kind.Goopling, seed)) goopling++;
    }
    expect(sniffer).toBeGreaterThanOrEqual(28);
    expect(sniffer - goopling).toBeGreaterThanOrEqual(8);
  });

  it('can still be caught', () => {
    let caught = 0;
    for (let seed = 1; seed <= 40; seed++) if (!survives(Kind.Sniffer, seed)) caught++;
    expect(caught).toBeGreaterThan(0); // it misjudges sometimes
  });
});

describe('Phaser', () => {
  it('hides, cannot be hit while hidden, then jumps far through a portal', () => {
    const g = arena();
    const m = add(g, Kind.Phaser, 6, 4, { timer: 1 });
    run(g, 2);
    expect(m.hidden).toBe(true);
    // A beam on its burrow does nothing.
    g.beams[4 * GRID_W + 6] = 30;
    run(g, 1);
    expect(m.alive).toBe(true);
    run(g, PHASER_HIDE_TICKS);
    expect(m.hidden).toBe(false);
    expect(Math.abs(m.x / TILE - 6) + Math.abs(m.y / TILE - 4)).toBeGreaterThanOrEqual(4);
    expect(g.portals).toHaveLength(1);
    expect(g.portals[0].from).toBe(4 * GRID_W + 6);
    expect(m.timer).toBeGreaterThan(PHASER_WANDER_TICKS - 5);
  });

  it('lets other Martians use its portal', () => {
    const g = arena();
    g.portals.push({ from: 4 * GRID_W + 4, to: 8 * GRID_W + 10, ticks: 100 });
    const m = add(g, Kind.Goopling, 4, 4);
    run(g, 1);
    expect([m.x, m.y]).toEqual([10 * TILE, 8 * TILE]);
  });

  it('closes its portals after a while', () => {
    const g = arena();
    g.portals.push({ from: 0, to: 5, ticks: 3 });
    run(g, 3);
    expect(g.portals).toHaveLength(0);
  });
});

describe('Builder', () => {
  it('builds a rock next to itself on a timer, up to its limit', () => {
    const g = arena();
    const b = add(g, Kind.Builder, 6, 6, { timer: BUILD_EVERY_TICKS });
    const rocks = () => g.grid.cells.filter((c) => c === Cell.Rock).length;
    run(g, BUILD_EVERY_TICKS - 10);
    expect(rocks()).toBe(0);
    run(g, 60);
    expect(rocks()).toBe(1);
    run(g, BUILD_EVERY_TICKS * (BUILDER_MAX_ROCKS + 4));
    expect(b.built).toBeLessThanOrEqual(BUILDER_MAX_ROCKS);
    expect(rocks()).toBe(b.built);
  });

  it('never builds on an astronaut', () => {
    const g = arena();
    g.players[0].x = 6 * TILE; g.players[0].y = 5 * TILE;
    add(g, Kind.Builder, 6, 6, { timer: 1 });
    for (let t = 0; t < BUILD_EVERY_TICKS * 6; t++) {
      step(g, [idle]);
      expect(g.grid.cells[5 * GRID_W + 6]).toBe(Cell.Empty);
    }
  });

  it('is toxic to touch', () => {
    const g = arena();
    g.players[0].shield = 0;
    add(g, Kind.Builder, 1, 0);
    g.freeze = 999;
    for (let i = 0; i < 10; i++) step(g, [{ dir: Dir.Right, alt: Dir.None, place: false }]);
    expect(g.players[0].alive).toBe(false);
  });
});

it('replays a mixed roster deterministically', () => {
  const play = () => {
    const g = createGame(21, { roster: levelRoster(18) });
    g.players[0].shield = 1e6;
    run(g, 1500);
    return hashState(g);
  };
  expect(play()).toBe(play());
});

describe('story progression', () => {
  it('every level spawns its whole roster, far from the start, on any map', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const spec = levelSpec(level);
      if (spec.roster.length === 0) continue;
      for (let seed = 1; seed <= 25; seed++) {
        const g = createGame(seed * 7919 + level, { roster: spec.roster, rules: spec.rules });
        expect(g.martians.map((m) => m.kind), `level ${level}, seed ${seed}`).toEqual(spec.roster);
      }
    }
  });

  it('grows steadily: never fewer Martians than the level before within a sector, one new kind at a time', () => {
    const seen = new Set<number>();
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const roster = levelRoster(level);
      if (roster.length === 0) continue;
      const prev = levelRoster(level - 1);
      if (level % 5 !== 1 && prev.length > 0) expect(roster.length, `level ${level}`).toBeGreaterThanOrEqual(prev.length);
      const fresh = new Set(roster.filter((k) => !seen.has(k)));
      expect(fresh.size, `level ${level} introduces ${[...fresh]}`).toBeLessThanOrEqual(1);
      roster.forEach((k) => seen.add(k));
    }
  });
});
