import {
  BITE_REACH, BUILD_EVERY_TICKS, BUILDER_MAX_ROCKS, Cell, DIR_DX, DIR_DY, Dir, FUSE_TICKS, Item, Kind,
  MARTIAN_SPAWN_DISTANCE, MARTIAN_SPEED, PHASER_HIDE_TICKS, PHASER_WANDER_TICKS, PORTAL_TICKS, SNIFF_DELAY_TICKS,
  SNIFF_MISS_ONE_IN, SPAWNS, TILE,
} from './constants';
import { SAFE, dangerMap, escapeStep } from './danger';
import { isWalkable } from './grid';
import { nextInt } from './rng';
import { playerTile, type GameState, type Martian } from './state';

// Martians move tile to tile on the grid (no physics) and bite astronauts.
//   Goopling: slow, wanders, turns at random at junctions.
//   Sniffer:  faster; notices charges after a delay and dodges blast lines (not always).
//   Phaser:   wanders, hides in a burrow (can't be hit), then jumps through a portal pair.
//   Builder:  slow and toxic to touch, never chases; builds Mars rocks next to itself.

const REVERSE = [Dir.None, Dir.Down, Dir.Up, Dir.Right, Dir.Left] as const;
const ALL_DIRS = [Dir.Up, Dir.Down, Dir.Left, Dir.Right] as const;
type MoveDir = (typeof ALL_DIRS)[number];

export function spawnMartians(state: GameState, roster: readonly Kind[]): void {
  const { grid } = state;
  const spots: number[] = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const x = i % grid.w, y = Math.floor(i / grid.w);
    if (!isWalkable(grid, x, y)) continue;
    if (SPAWNS.some(([sx, sy]) => Math.abs(x - sx) + Math.abs(y - sy) < MARTIAN_SPAWN_DISTANCE)) continue;
    spots.push(i);
  }
  roster.forEach((kind, n) => {
    if (spots.length === 0) return;
    const i = spots.splice(nextInt(state, spots.length), 1)[0];
    state.martians.push({
      id: n + 1, kind, x: (i % grid.w) * TILE, y: Math.floor(i / grid.w) * TILE, dir: Dir.None, alive: true,
      timer: kind === Kind.Phaser ? PHASER_WANDER_TICKS : kind === Kind.Builder ? BUILD_EVERY_TICKS : 0,
      hidden: false, built: 0,
    });
  });
}

function martianCanEnter(state: GameState, tx: number, ty: number): boolean {
  return isWalkable(state.grid, tx, ty) && !state.charges.some((c) => c.tx === tx && c.ty === ty);
}

/** Keep going in corridors, turn at random at junctions, turn back at dead ends. */
function wanderDir(state: GameState, m: Martian, open: MoveDir[]): Dir {
  const forward = open.filter((d) => d !== REVERSE[m.dir]);
  if (forward.length === 0) return open[0];
  const straight = forward.includes(m.dir as MoveDir);
  if (straight && (forward.length === 1 || nextInt(state, 2) === 0)) return m.dir;
  return forward[nextInt(state, forward.length)];
}

/** Sniffer: avoid tiles a noticed charge is about to hit; otherwise wander. */
function sniffDir(state: GameState, m: Martian, open: MoveDir[], tx: number, ty: number): Dir {
  if (nextInt(state, SNIFF_MISS_ONE_IN) === 0) return wanderDir(state, m, open);
  const noticed = (c: { fuse: number }) => FUSE_TICKS - c.fuse >= SNIFF_DELAY_TICKS;
  if (!state.charges.some(noticed) && !state.beams.some((b) => b > 0)) return wanderDir(state, m, open);
  const danger = dangerMap(state, undefined, noticed);
  const w = state.grid.w;
  if (danger[ty * w + tx] !== SAFE) {
    // In a blast line: run for the nearest safe tile it can reach in time.
    const perTile = Math.ceil(TILE / MARTIAN_SPEED[m.kind]);
    const out = escapeStep(state, tx, ty, perTile, danger, (x, y) => martianCanEnter(state, x, y));
    if (out !== Dir.None) return out;
  }
  // Otherwise wander, but never step into a threatened tile.
  const safe = open.filter((d) => danger[(ty + DIR_DY[d]) * w + tx + DIR_DX[d]] === SAFE);
  if (safe.length > 0) return wanderDir(state, m, safe);
  return danger[ty * w + tx] === SAFE ? Dir.None : wanderDir(state, m, open); // wait it out where it is safe
}

function chooseDir(state: GameState, m: Martian, tx: number, ty: number): Dir {
  const open = ALL_DIRS.filter((d) => martianCanEnter(state, tx + DIR_DX[d], ty + DIR_DY[d]));
  if (open.length === 0) return Dir.None;
  return m.kind === Kind.Sniffer ? sniffDir(state, m, open, tx, ty) : wanderDir(state, m, open);
}

/** The next tile centre ahead of a Martian along its direction. */
function nextCentre(m: Martian): [number, number] {
  const dx = DIR_DX[m.dir], dy = DIR_DY[m.dir];
  const ahead = (v: number, d: number) => (d > 0 ? Math.floor(v / TILE) + 1 : d < 0 ? Math.ceil(v / TILE) - 1 : v / TILE);
  return [ahead(m.x, dx), ahead(m.y, dy)];
}

function moveMartian(state: GameState, m: Martian): void {
  let budget = MARTIAN_SPEED[m.kind];
  for (let guard = 0; budget > 0 && guard < 4; guard++) {
    const centred = m.x % TILE === 0 && m.y % TILE === 0;
    if (centred) {
      const tx = m.x / TILE, ty = m.y / TILE;
      if (usePortal(state, m, tx, ty)) return;
      if (m.kind === Kind.Builder) build(state, m, tx, ty);
      if (m.kind === Kind.Phaser && m.timer <= 0) return burrow(m);
      m.dir = chooseDir(state, m, tx, ty);
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

// --- Phaser and portals ----------------------------------------------------------

function burrow(m: Martian): void {
  m.hidden = true;
  m.timer = PHASER_HIDE_TICKS;
  m.dir = Dir.None;
}

/** Leaves the burrow through a fresh portal pair to a far, empty tile. */
function emerge(state: GameState, m: Martian): void {
  const { grid } = state;
  const here = Math.round(m.y / TILE) * grid.w + Math.round(m.x / TILE);
  const hx = here % grid.w, hy = Math.floor(here / grid.w);
  const spots: number[] = [];
  for (let i = 0; i < grid.cells.length; i++) {
    const x = i % grid.w, y = Math.floor(i / grid.w);
    if (!martianCanEnter(state, x, y) || Math.abs(x - hx) + Math.abs(y - hy) < 4) continue;
    if (state.players.some((p) => p.alive && Math.abs(playerTile(p)[0] - x) + Math.abs(playerTile(p)[1] - y) < 3)) continue;
    spots.push(i);
  }
  m.hidden = false;
  m.timer = PHASER_WANDER_TICKS;
  if (spots.length === 0) return; // nowhere to go: come back up where it is
  const to = spots[nextInt(state, spots.length)];
  state.portals.push({ from: here, to, ticks: PORTAL_TICKS });
  m.x = (to % grid.w) * TILE;
  m.y = Math.floor(to / grid.w) * TILE;
  state.events.push({ type: 'phaser_jumped', id: m.id, from: here, to });
}

/** Any Martian reaching an open portal's entry tile comes out at its exit. */
function usePortal(state: GameState, m: Martian, tx: number, ty: number): boolean {
  const portal = state.portals.find((p) => p.from === ty * state.grid.w + tx);
  if (!portal) return false;
  m.x = (portal.to % state.grid.w) * TILE;
  m.y = Math.floor(portal.to / state.grid.w) * TILE;
  m.dir = Dir.None;
  return true;
}

// --- Builder ------------------------------------------------------------------------

/** Places a Mars rock on a free neighbouring tile when its timer is up. */
function build(state: GameState, m: Martian, tx: number, ty: number): void {
  if (m.timer > 0 || m.built >= BUILDER_MAX_ROCKS) return;
  const { grid } = state;
  const occupied = (x: number, y: number) =>
    state.players.some((p) => p.alive && Math.abs(p.x - x * TILE) < TILE && Math.abs(p.y - y * TILE) < TILE) ||
    state.martians.some((o) => o.alive && Math.abs(o.x - x * TILE) < TILE && Math.abs(o.y - y * TILE) < TILE);
  const options = ALL_DIRS.map((d) => [tx + DIR_DX[d], ty + DIR_DY[d]] as const).filter(([x, y]) => {
    const i = y * grid.w + x;
    return martianCanEnter(state, x, y) && state.items[i] === Item.None && i !== state.gate && state.beams[i] === 0 && !occupied(x, y);
  });
  if (options.length === 0) {
    m.timer = 30; // try again shortly
    return;
  }
  const [x, y] = options[nextInt(state, options.length)];
  grid.cells[y * grid.w + x] = Cell.Rock;
  m.built++;
  m.timer = BUILD_EVERY_TICKS;
  state.events.push({ type: 'rock_built', tx: x, ty: y });
}

// --- Per tick ------------------------------------------------------------------------

/** Moves Martians (unless frozen), runs their timers, then defeats those standing in a beam. */
export function updateMartians(state: GameState): void {
  if (state.freeze > 0) state.freeze--;
  if (state.freeze === 0) {
    for (const p of state.portals) p.ticks--;
    state.portals = state.portals.filter((p) => p.ticks > 0);
  }
  for (const m of state.martians) {
    if (!m.alive) continue;
    if (state.freeze === 0) {
      if (m.timer > 0) m.timer--;
      if (m.hidden) {
        if (m.timer <= 0) emerge(state, m);
      } else {
        moveMartian(state, m);
      }
    }
    if (m.hidden) continue; // safe in its burrow
    const [tx, ty] = playerTile(m);
    if (state.beams[ty * state.grid.w + tx] > 0) {
      m.alive = false;
      state.events.push({ type: 'martian_killed', id: m.id, tx, ty });
    }
  }
}

/** Is any visible Martian close enough to bite (or, for the Builder, poison) this position? */
export function biteAt(state: GameState, x: number, y: number): boolean {
  return state.martians.some((m) => m.alive && !m.hidden && Math.abs(m.x - x) < BITE_REACH && Math.abs(m.y - y) < BITE_REACH);
}
