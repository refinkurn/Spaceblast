import { BITE_REACH, DIR_DX, DIR_DY, Dir, GOOPLING_SPEED, MARTIAN_SPAWN_DISTANCE, SPAWNS, TILE, type Kind } from './constants';
import { isWalkable } from './grid';
import { nextInt } from './rng';
import { playerTile, type GameState, type Martian } from './state';

// Martians move tile to tile on the grid (no physics) and bite astronauts.
// Phase 1 has the Goopling: slow, wanders, turns at random at junctions.

const REVERSE = [Dir.None, Dir.Down, Dir.Up, Dir.Right, Dir.Left] as const;
const ALL_DIRS = [Dir.Up, Dir.Down, Dir.Left, Dir.Right] as const;

export function spawnMartians(state: GameState, kind: Kind, count: number): void {
  const { grid } = state;
  const spots: number[] = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const x = i % grid.w, y = Math.floor(i / grid.w);
    if (!isWalkable(grid, x, y)) continue;
    if (SPAWNS.some(([sx, sy]) => Math.abs(x - sx) + Math.abs(y - sy) < MARTIAN_SPAWN_DISTANCE)) continue;
    spots.push(i);
  }
  for (let n = 0; n < count && spots.length > 0; n++) {
    const i = spots.splice(nextInt(state, spots.length), 1)[0];
    state.martians.push({ id: n + 1, kind, x: (i % grid.w) * TILE, y: Math.floor(i / grid.w) * TILE, dir: Dir.None, alive: true });
  }
}

function martianCanEnter(state: GameState, tx: number, ty: number): boolean {
  return isWalkable(state.grid, tx, ty) && !state.charges.some((c) => c.tx === tx && c.ty === ty);
}

/** Picks a direction at a tile centre: keep going in corridors, turn at random at junctions. */
function chooseDir(state: GameState, m: Martian, tx: number, ty: number): Dir {
  const open = ALL_DIRS.filter((d) => martianCanEnter(state, tx + DIR_DX[d], ty + DIR_DY[d]));
  if (open.length === 0) return Dir.None;
  const forward = open.filter((d) => d !== REVERSE[m.dir]);
  if (forward.length === 0) return open[0]; // dead end: turn back
  const straight = forward.includes(m.dir as (typeof ALL_DIRS)[number]);
  if (straight && (forward.length === 1 || nextInt(state, 2) === 0)) return m.dir;
  return forward[nextInt(state, forward.length)];
}

/** The next tile centre ahead of a Martian along its direction. */
function nextCentre(m: Martian): [number, number] {
  const dx = DIR_DX[m.dir], dy = DIR_DY[m.dir];
  const ahead = (v: number, d: number) => (d > 0 ? Math.floor(v / TILE) + 1 : d < 0 ? Math.ceil(v / TILE) - 1 : v / TILE);
  return [ahead(m.x, dx), ahead(m.y, dy)];
}

function moveMartian(state: GameState, m: Martian, speed: number): void {
  let budget = speed;
  for (let guard = 0; budget > 0 && guard < 4; guard++) {
    const centred = m.x % TILE === 0 && m.y % TILE === 0;
    if (centred) {
      m.dir = chooseDir(state, m, m.x / TILE, m.y / TILE);
      if (m.dir === Dir.None) return;
    }
    let [tx, ty] = nextCentre(m);
    if (!centred && !martianCanEnter(state, tx, ty)) {
      // A charge appeared ahead: turn around and head back to the last centre.
      m.dir = REVERSE[m.dir];
      [tx, ty] = nextCentre(m);
    }
    const dist = Math.abs(tx * TILE - m.x) + Math.abs(ty * TILE - m.y);
    const stepLen = Math.min(budget, dist);
    m.x += Math.sign(tx * TILE - m.x) * stepLen;
    m.y += Math.sign(ty * TILE - m.y) * stepLen;
    budget -= stepLen;
  }
}

/** Moves Martians (unless frozen), then kills those standing in a beam. */
export function updateMartians(state: GameState): void {
  if (state.freeze > 0) state.freeze--;
  for (const m of state.martians) {
    if (!m.alive) continue;
    if (state.freeze === 0) moveMartian(state, m, GOOPLING_SPEED);
    const [tx, ty] = playerTile(m);
    if (state.beams[ty * state.grid.w + tx] > 0) {
      m.alive = false;
      state.events.push({ type: 'martian_killed', id: m.id, tx, ty });
    }
  }
}

/** Is any living Martian close enough to bite this position? */
export function biteAt(state: GameState, x: number, y: number): boolean {
  return state.martians.some((m) => m.alive && Math.abs(m.x - x) < BITE_REACH && Math.abs(m.y - y) < BITE_REACH);
}
