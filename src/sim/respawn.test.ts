import { describe, expect, it } from 'vitest';
import { BEAM_FADE_TICKS, Cell, Dir, GRID_W, TILE } from './constants';
import type { PlayerCommand } from './command';
import { isWalkable } from './grid';
import { respawnTile } from './lives';
import { step } from './sim';
import { createGame, playerTile, type GameState } from './state';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };

function emptyArena(): GameState {
  const g = createGame(1, { martians: 0 });
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  g.items.fill(0);
  g.gate = -1;
  return g;
}

describe('beam fade-out', () => {
  it('a fading beam is harmless', () => {
    const g = emptyArena();
    const p = g.players[0];
    p.x = 4 * TILE; p.y = 4 * TILE;
    g.beams[4 * GRID_W + 4] = BEAM_FADE_TICKS;
    step(g, [idle]);
    expect(p.alive).toBe(true);
    expect(p.lives).toBe(3);
  });

  it('a beam is still dangerous until its fade starts', () => {
    const g = emptyArena();
    const p = g.players[0];
    p.x = 4 * TILE; p.y = 4 * TILE;
    g.beams[4 * GRID_W + 4] = BEAM_FADE_TICKS + 2;
    step(g, [idle]);
    expect(p.alive).toBe(false);
  });
});

describe('respawn', () => {
  it('warps back to the spawn corner when it is free', () => {
    const g = emptyArena();
    expect(respawnTile(g, g.players[0])).toEqual([0, 0]);
  });

  it('never warps into a rock that took the spawn corner', () => {
    const g = emptyArena();
    const p = g.players[0];
    p.alive = false; p.respawn = 1; p.x = 4 * TILE; p.y = 4 * TILE;
    g.grid.cells[0] = Cell.Rock; // e.g. a Maze Shift or a Builder put a rock on (0, 0)
    step(g, [idle]);
    expect(p.alive).toBe(true);
    const [tx, ty] = playerTile(p);
    expect([tx, ty]).not.toEqual([0, 0]);
    expect(isWalkable(g.grid, tx, ty)).toBe(true);
    expect(Math.abs(tx) + Math.abs(ty)).toBe(1); // the nearest free tile
  });

  it('skips tiles with a charge or a live beam', () => {
    const g = emptyArena();
    g.grid.cells[0] = Cell.Rock;
    g.charges.push({ id: 99, owner: 0, tx: 1, ty: 0, fuse: 100, range: 1 });
    g.beams[1 * GRID_W + 0] = BEAM_FADE_TICKS + 5;
    const [tx, ty] = respawnTile(g, g.players[0]);
    expect([[1, 0], [0, 1], [0, 0]]).not.toContainEqual([tx, ty]);
    expect(Math.abs(tx) + Math.abs(ty)).toBe(2);
  });
});
