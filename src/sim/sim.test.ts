import { describe, expect, it } from 'vitest';
import { Cell, Dir, GRID_H, GRID_W, SPAWNS, TILE, type Dir as DirT } from './constants';
import type { PlayerCommand } from './command';
import { cellAt, generateGrid, inSpawnZone } from './grid';
import { nextInt, seedRng } from './rng';
import { hashState, step } from './sim';
import { createGame, type GameState } from './state';

const cmd = (dir: DirT, alt: DirT = Dir.None): PlayerCommand => ({ dir, alt, place: false });

/** A game with no rocks, so only pillars and edges block movement. */
function emptyArena(): GameState {
  const g = createGame(1);
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  return g;
}

function run(g: GameState, c: PlayerCommand, ticks: number) {
  for (let i = 0; i < ticks; i++) step(g, [c]);
}

describe('grid', () => {
  it('is identical for the same seed', () => {
    expect(generateGrid({ rng: seedRng(42) }).cells).toEqual(generateGrid({ rng: seedRng(42) }).cells);
  });

  it('differs for different seeds', () => {
    expect(generateGrid({ rng: seedRng(1) }).cells).not.toEqual(generateGrid({ rng: seedRng(2) }).cells);
  });

  it('keeps pillars on odd/odd tiles and spawn corners rock-free', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = generateGrid({ rng: seedRng(seed) });
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const c = cellAt(g, x, y);
          if (x % 2 === 1 && y % 2 === 1) expect(c).toBe(Cell.Pillar);
          else if (inSpawnZone(x, y)) expect(c).toBe(Cell.Empty);
        }
      }
      for (const [sx, sy] of SPAWNS) expect(cellAt(g, sx, sy)).toBe(Cell.Empty);
    }
  });

  it('treats out-of-bounds as a pillar', () => {
    const g = generateGrid({ rng: seedRng(3) });
    expect(cellAt(g, -1, 0)).toBe(Cell.Pillar);
    expect(cellAt(g, GRID_W, 0)).toBe(Cell.Pillar);
  });
});

describe('movement', () => {
  it('moves right along an open lane and stops on a tile centre', () => {
    const g = emptyArena();
    run(g, cmd(Dir.Right), 60);
    const p = g.players[0];
    expect(p.y).toBe(0);
    expect(p.x).toBeGreaterThan(3 * TILE);
    run(g, cmd(Dir.None), 30);
    expect(p.x % TILE).toBe(0);
  });

  it('is blocked by the map edge', () => {
    const g = emptyArena();
    run(g, cmd(Dir.Up), 30);
    run(g, cmd(Dir.Left), 30);
    expect(g.players[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('is blocked by a pillar', () => {
    const g = emptyArena();
    g.players[0].x = 1 * TILE; // above the pillar at (1,1)
    run(g, cmd(Dir.Down), 30);
    expect(g.players[0]).toMatchObject({ x: TILE, y: 0 });
  });

  it('corner-assists into an open turn', () => {
    const g = emptyArena();
    const p = g.players[0];
    p.x = 1700; // between tile 1 (pillar below) and tile 2 (open below)
    run(g, cmd(Dir.Down), 30);
    expect(p.x).toBe(2 * TILE);
    expect(p.y).toBeGreaterThan(TILE);
  });

  it('prefers the nearer open lane', () => {
    const g = emptyArena();
    const p = g.players[0];
    p.x = 2300; // nearer lane is 2, whose tile below is open
    run(g, cmd(Dir.Down), 10);
    expect(p.x).toBe(2 * TILE);
  });

  it('does not slide when both lanes are blocked', () => {
    const g = emptyArena();
    const p = g.players[0];
    g.grid.cells[1 * GRID_W + 2] = Cell.Rock; // block (2,1); (1,1) is a pillar
    p.x = 1500;
    run(g, cmd(Dir.Down), 10);
    expect(p).toMatchObject({ x: 1500, y: 0 });
  });

  it('uses the fallback direction on diagonal input', () => {
    const g = emptyArena();
    run(g, cmd(Dir.Up, Dir.Right), 30); // up is the edge, so it goes right
    expect(g.players[0].x).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  function scripted(seed: number, ticks: number): PlayerCommand[] {
    const r = { rng: seedRng(seed) };
    const out: PlayerCommand[] = [];
    let current = cmd(Dir.None);
    for (let i = 0; i < ticks; i++) {
      if (i % 20 === 0) current = cmd(nextInt(r, 5) as DirT, nextInt(r, 5) as DirT);
      out.push(current);
    }
    return out;
  }

  function play(seed: number, commands: PlayerCommand[]): number {
    const g = createGame(seed);
    for (const c of commands) step(g, [c]);
    return hashState(g);
  }

  it('replays 600 ticks to the same hash', () => {
    const commands = scripted(7, 600);
    expect(play(99, commands)).toBe(play(99, commands));
  });

  it('replays from a saved command log', () => {
    const commands = scripted(8, 600);
    const restored = JSON.parse(JSON.stringify(commands)) as PlayerCommand[];
    expect(play(5, restored)).toBe(play(5, commands));
  });

  it('keeps positions as integers', () => {
    const g = createGame(11);
    for (const c of scripted(9, 600)) {
      step(g, [c]);
      expect(Number.isInteger(g.players[0].x) && Number.isInteger(g.players[0].y)).toBe(true);
    }
  });
});
