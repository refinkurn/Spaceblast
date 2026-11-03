import { describe, expect, it } from 'vitest';
import { BEAM_TICKS, CHASE_RANGE, Cell, Dir, GOOPLING_SPEED, GRID_W, Kind, MARTIAN_SPEED, TILE } from './constants';
import type { PlayerCommand } from './command';
import { chaseStep } from './martians';
import { levelRoster } from './levels';
import { seedRng } from './rng';
import { hashState, step } from './sim';
import { createGame, type GameState, type Martian } from './state';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };
const run = (g: GameState, ticks: number) => { for (let i = 0; i < ticks; i++) step(g, [idle]); };

/** Classic arena with no rocks; player 0 shielded at (px, py). */
function arena(px: number, py: number, seed = 1): GameState {
  const g = createGame(1, { martians: 0 });
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  g.items.fill(0);
  g.gate = -1;
  g.rng = seedRng(seed);
  g.players[0].shield = 1e6;
  g.players[0].x = px * TILE; g.players[0].y = py * TILE;
  return g;
}

function add(g: GameState, kind: Kind, tx: number, ty: number): Martian {
  const m: Martian = { id: g.martians.length + 1, kind, x: tx * TILE, y: ty * TILE, dir: Dir.None, alive: true, timer: 0, hidden: false, built: 0 };
  g.martians.push(m);
  return m;
}

describe('Chaser (hungry Goopling)', () => {
  it('moves at Goopling speed', () => {
    expect(MARTIAN_SPEED[Kind.Chaser]).toBe(GOOPLING_SPEED);
    expect(CHASE_RANGE).toBe(4);
  });

  it('heads for an astronaut within 4 steps and bites', () => {
    const g = arena(4, 0);
    const m = add(g, Kind.Chaser, 4, 4);
    run(g, Math.ceil(TILE / GOOPLING_SPEED));
    expect(m.x).toBe(4 * TILE); // straight up the column...
    expect(m.y).toBeLessThanOrEqual(3 * TILE); // ...a whole tile closer
    g.players[0].shield = 0;
    run(g, 4 * Math.ceil(TILE / GOOPLING_SPEED));
    expect(g.players[0].lives).toBeLessThan(3);
  });

  it('counts steps along the walking path, not straight-line distance', () => {
    const g = arena(2, 0);
    expect(chaseStep(g, 2, 2)).toBe(Dir.Up); // 2 steps
    g.grid.cells[1 * GRID_W + 2] = Cell.Rock; // now the way round is 6 steps: too far
    expect(chaseStep(g, 2, 2)).toBe(Dir.None);
    g.grid.cells[1 * GRID_W + 2] = Cell.Empty;
    g.players[0].alive = false; // a knocked-out astronaut is no target
    expect(chaseStep(g, 2, 2)).toBe(Dir.None);
  });

  it('goes for the nearest of several astronauts', () => {
    const g = createGame(1, { martians: 0, mode: 'survival', players: 2 });
    g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
    g.players[0].x = 6 * TILE; g.players[0].y = 0;
    g.players[1].x = 6 * TILE; g.players[1].y = 6 * TILE;
    expect(chaseStep(g, 6, 4)).toBe(Dir.Down);
    expect(chaseStep(g, 6, 3)).toBe(Dir.Up); // 3 up vs 3 down: a tie goes Up, the first direction checked
  });

  it('wanders exactly like a Goopling while nobody is close', () => {
    const play = (kind: Kind) => {
      const g = arena(0, 0, 5);
      const m = add(g, kind, 12, 10);
      const path: number[] = [];
      for (let t = 0; t < 90; t++) { step(g, [idle]); path.push(m.x, m.y); }
      return path;
    };
    expect(play(Kind.Chaser)).toEqual(play(Kind.Goopling));
  });

  it('stops when frozen and falls to a beam like a Goopling', () => {
    const g = arena(4, 0);
    const m = add(g, Kind.Chaser, 4, 4);
    g.freeze = 30;
    run(g, 20);
    expect([m.x, m.y]).toEqual([4 * TILE, 4 * TILE]);
    g.beams[4 * GRID_W + 4] = BEAM_TICKS;
    g.beamOwner[4 * GRID_W + 4] = 1;
    run(g, 1);
    expect(m.alive).toBe(false);
    expect(g.events).toContainEqual({ type: 'martian_killed', id: m.id, tx: 4, ty: 4 });
  });

  it('replays a Chaser level deterministically', () => {
    const play = () => {
      const g = createGame(33, { roster: levelRoster(4) });
      g.players[0].shield = 1e6;
      run(g, 1500);
      return hashState(g);
    };
    expect(play()).toBe(play());
  });
});
