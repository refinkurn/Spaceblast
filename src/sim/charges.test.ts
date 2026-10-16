import { describe, expect, it } from 'vitest';
import { BEAM_TICKS, Cell, Dir, FUSE_TICKS, GRID_W, RESPAWN_TICKS, START_RANGE, TILE, type Dir as DirT } from './constants';
import type { PlayerCommand } from './command';
import { cellAt } from './grid';
import { step } from './sim';
import { createGame, type GameState } from './state';

const cmd = (dir: DirT = Dir.None, place = false): PlayerCommand => ({ dir, alt: Dir.None, place });
const idle = cmd();
const placeNow = cmd(Dir.None, true);

/** No rocks at all: only pillars (odd/odd) and edges. */
function emptyArena(players = 1): GameState {
  const g = createGame(1, { players, martians: 0 });
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  g.items.fill(0);
  g.gate = -1;
  return g;
}

function run(g: GameState, c: PlayerCommand | PlayerCommand[], ticks: number) {
  for (let i = 0; i < ticks; i++) step(g, Array.isArray(c) ? c : [c]);
}

function setRock(g: GameState, x: number, y: number) {
  g.grid.cells[y * GRID_W + x] = Cell.Rock;
}

describe('placing charges', () => {
  it('places one charge on the player tile when the button goes down', () => {
    const g = emptyArena();
    step(g, [placeNow]);
    expect(g.charges).toHaveLength(1);
    expect(g.charges[0]).toMatchObject({ tx: 0, ty: 0, owner: 0, range: START_RANGE });
    expect(g.events).toContainEqual({ type: 'charge_placed', tx: 0, ty: 0 });
  });

  it('places only one while the button is held', () => {
    const g = emptyArena();
    g.players[0].maxCharges = 3;
    run(g, cmd(Dir.Right, true), 40); // walks across several tiles while holding
    expect(g.charges).toHaveLength(1);
  });

  it('respects the max charges limit', () => {
    const g = emptyArena();
    step(g, [placeNow]);
    run(g, cmd(Dir.Right), 30);
    step(g, [idle]);
    step(g, [cmd(Dir.None, true)]);
    expect(g.charges).toHaveLength(1);
  });

  it('lets the owner walk off its charge but not back on', () => {
    const g = emptyArena();
    step(g, [placeNow]);
    run(g, cmd(Dir.Right), 30);
    expect(g.players[0].x).toBeGreaterThanOrEqual(TILE);
    run(g, cmd(Dir.Left), 30);
    expect(g.players[0].x).toBe(TILE); // stopped next to the charge
  });

  it('blocks other players', () => {
    const g = emptyArena(2);
    const [a, b] = g.players;
    b.x = 2 * TILE; b.y = 0; // b stands two tiles right of a
    a.x = 1 * TILE;
    step(g, [placeNow, idle]); // charge at (1,0)
    run(g, [cmd(Dir.Left), idle], 30); // a walks off to (0,0)
    run(g, [idle, cmd(Dir.Left)], 30);
    expect(b.x).toBe(2 * TILE);
  });
});

describe('detonation', () => {
  it('reaches 1 tile each way by default', () => {
    const g = emptyArena();
    g.players[0].x = 4 * TILE; g.players[0].y = 4 * TILE;
    step(g, [placeNow]);
    g.players[0].alive = false; g.players[0].respawn = 999;
    run(g, idle, g.charges[0].fuse);
    const beamAt = (x: number, y: number) => g.beams[y * GRID_W + x] > 0;
    expect([beamAt(4, 4), beamAt(5, 4), beamAt(3, 4), beamAt(4, 3), beamAt(4, 5)]).toEqual([true, true, true, true, true]);
    expect([beamAt(6, 4), beamAt(2, 4), beamAt(4, 2), beamAt(4, 6)]).toEqual([false, false, false, false]);
  });

  it('explodes after the fuse and leaves beams for BEAM_TICKS', () => {
    const g = emptyArena();
    g.players[0].x = 4 * TILE; g.players[0].y = 4 * TILE;
    g.players[0].range = 2;
    step(g, [placeNow]);
    g.players[0].alive = false; g.players[0].respawn = 999; // keep the player out of the way
    expect(g.charges[0].fuse).toBe(FUSE_TICKS - 1);
    run(g, idle, g.charges[0].fuse - 1);
    expect(g.charges).toHaveLength(1);
    step(g, [idle]);
    expect(g.charges).toHaveLength(0);
    expect(g.events).toContainEqual({ type: 'charge_exploded', tx: 4, ty: 4 });
    const beamAt = (x: number, y: number) => g.beams[y * GRID_W + x];
    expect(beamAt(4, 4)).toBe(BEAM_TICKS);
    expect(beamAt(6, 4)).toBe(BEAM_TICKS); // range 2 along the row
    expect(beamAt(7, 4)).toBe(0);
    expect(beamAt(5, 5)).toBe(0); // no diagonals
    run(g, idle, BEAM_TICKS);
    expect(beamAt(4, 4)).toBe(0);
  });

  it('stops at pillars', () => {
    const g = emptyArena();
    g.players[0].x = 1 * TILE; g.players[0].y = 0; // pillar below at (1,1)
    step(g, [placeNow]);
    g.players[0].alive = false; g.players[0].respawn = 999; // keep the player out of the way
    run(g, idle, FUSE_TICKS);
    expect(g.beams[1 * GRID_W + 1]).toBe(0);
    expect(g.beams[2 * GRID_W + 1]).toBe(0);
  });

  it('breaks the first rock and stops there', () => {
    const g = emptyArena();
    setRock(g, 2, 0);
    setRock(g, 3, 0);
    g.players[0].range = 2;
    step(g, [placeNow]); // at (0,0), range 2 to the right: (1,0), rock at (2,0)
    g.players[0].alive = false; g.players[0].respawn = 999;
    run(g, idle, g.charges[0].fuse);
    expect(cellAt(g.grid, 2, 0)).toBe(Cell.Empty);
    expect(cellAt(g.grid, 3, 0)).toBe(Cell.Rock);
    expect(g.events).toContainEqual({ type: 'rock_broken', tx: 2, ty: 0 });
  });

  it('sets off other charges in range in the same tick', () => {
    const g = emptyArena(2);
    const [a, b] = g.players;
    a.x = 0; a.y = 4 * TILE;
    b.x = 2 * TILE; b.y = 4 * TILE;
    a.range = b.range = 2;
    step(g, [placeNow, idle]);
    run(g, idle, 60);
    step(g, [idle, placeNow]); // b's charge has a much longer fuse left
    a.alive = b.alive = false; a.respawn = b.respawn = 999;
    run(g, idle, g.charges[0].fuse - 1);
    expect(g.charges).toHaveLength(2);
    step(g, [idle, idle]);
    expect(g.charges).toHaveLength(0);
    expect(g.events.filter((e) => e.type === 'charge_exploded')).toHaveLength(2);
    expect(g.beams[4 * GRID_W + 4]).toBe(BEAM_TICKS); // b's beam reached (4,4)
  });
});

describe('knock-outs', () => {
  it('knocks out a player in a beam and warps it back to spawn', () => {
    const g = emptyArena();
    step(g, [placeNow]);
    run(g, idle, FUSE_TICKS - 1);
    const p = g.players[0];
    expect(p.alive).toBe(false);
    expect(g.events).toContainEqual({ type: 'player_died', id: 0, tx: 0, ty: 0 });
    run(g, idle, RESPAWN_TICKS);
    expect(p.alive).toBe(true);
    expect(p).toMatchObject({ x: 0, y: 0 });
  });

  it('is safe outside the beam', () => {
    const g = emptyArena();
    step(g, [placeNow]);
    run(g, cmd(Dir.Right), 60); // to (4,0) then (3,0) range 2 reaches (2,0)
    run(g, idle, FUSE_TICKS);
    expect(g.players[0].alive).toBe(true);
  });
});
