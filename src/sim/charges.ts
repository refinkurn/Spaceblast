import { BEAM_TICKS, Cell, DIR_DX, DIR_DY, FUSE_TICKS, RESPAWN_TICKS, TILE } from './constants';
import { cellAt, inBounds, isWalkable } from './grid';
import { playerTile, warpToSpawn, type Charge, type GameState, type Player } from './state';

// Plasma Charges: placing, fuses, cross-shaped beams, chain reactions,
// breaking rocks and knocking out players.

export function chargeAt(state: GameState, tx: number, ty: number): Charge | undefined {
  return state.charges.find((c) => c.tx === tx && c.ty === ty);
}

/** Can player `p` enter tile (tx, ty)? Rocks, pillars and charges block, except a charge it is still standing on. */
export function canWalk(state: GameState, p: Player, tx: number, ty: number): boolean {
  if (!isWalkable(state.grid, tx, ty)) return false;
  const c = chargeAt(state, tx, ty);
  return !c || p.passable.includes(c.id);
}

/** Places a charge on the player's tile when the button goes down (not while held). */
export function tryPlace(state: GameState, p: Player, place: boolean): void {
  const pressed = place && !p.placeHeld;
  p.placeHeld = place;
  if (!pressed || !p.alive) return;
  const [tx, ty] = playerTile(p);
  if (chargeAt(state, tx, ty)) return;
  if (state.charges.filter((c) => c.owner === p.id).length >= p.maxCharges) return;
  const c: Charge = { id: state.nextChargeId++, owner: p.id, tx, ty, fuse: FUSE_TICKS, range: p.range };
  state.charges.push(c);
  p.passable.push(c.id);
  state.events.push({ type: 'charge_placed', tx, ty });
}

/** Once a player has fully left a charge's tile, that charge blocks it too. */
export function updatePassable(state: GameState, p: Player): void {
  p.passable = p.passable.filter((id) => {
    const c = state.charges.find((k) => k.id === id);
    return c !== undefined && Math.abs(p.x - c.tx * TILE) < TILE && Math.abs(p.y - c.ty * TILE) < TILE;
  });
}

/** Burns down beams and fuses, and detonates charges (including chain reactions). */
export function tickCharges(state: GameState): void {
  const { beams, grid } = state;
  for (let i = 0; i < beams.length; i++) if (beams[i] > 0) beams[i]--;

  const queue: Charge[] = [];
  for (const c of state.charges) {
    c.fuse--;
    if (c.fuse <= 0 || beams[c.ty * grid.w + c.tx] > 0) queue.push(c);
  }
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (state.charges.includes(c)) explode(state, c, queue);
  }
}

function explode(state: GameState, c: Charge, queue: Charge[]): void {
  const { grid, beams } = state;
  state.charges = state.charges.filter((k) => k !== c);
  state.events.push({ type: 'charge_exploded', tx: c.tx, ty: c.ty });
  beams[c.ty * grid.w + c.tx] = BEAM_TICKS;

  for (let d = 1; d <= 4; d++) {
    for (let r = 1; r <= c.range; r++) {
      const x = c.tx + DIR_DX[d] * r;
      const y = c.ty + DIR_DY[d] * r;
      if (!inBounds(grid, x, y)) break;
      const cell = cellAt(grid, x, y);
      if (cell === Cell.Pillar) break;
      beams[y * grid.w + x] = BEAM_TICKS;
      if (cell === Cell.Rock) {
        grid.cells[y * grid.w + x] = Cell.Empty;
        state.events.push({ type: 'rock_broken', tx: x, ty: y });
        break;
      }
      const other = chargeAt(state, x, y);
      if (other) queue.push(other); // chain reaction, same tick
    }
  }
}

/** Knocks out players standing in a beam; warps knocked-out players back after a delay. */
export function updateLives(state: GameState): void {
  for (const p of state.players) {
    if (!p.alive) {
      if (--p.respawn <= 0) {
        warpToSpawn(p);
        p.alive = true;
        state.events.push({ type: 'player_respawned', id: p.id });
      }
      continue;
    }
    const [tx, ty] = playerTile(p);
    if (state.beams[ty * state.grid.w + tx] > 0) {
      p.alive = false;
      p.respawn = RESPAWN_TICKS;
      p.placeHeld = false;
      state.events.push({ type: 'player_died', id: p.id, tx, ty });
    }
  }
}
