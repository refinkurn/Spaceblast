import { BEAM_FADE_TICKS, BEAM_TICKS, Cell, DIR_DX, DIR_DY, FUSE_TICKS, Item, TILE } from './constants';
import { cellAt, inBounds, isWalkable } from './grid';
import { playerTile, type Charge, type GameState, type Player } from './state';

// Plasma Charges: placing, fuses, cross-shaped beams, chain reactions and
// breaking rocks. Knock-outs live in lives.ts.

/** Is the beam on tile index i still dangerous (not yet in its harmless fade-out)? */
export function beamHot(state: GameState, i: number): boolean {
  return state.beams[i] > BEAM_FADE_TICKS;
}

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
    if (c.fuse <= 0 || beamHot(state, c.ty * grid.w + c.tx)) queue.push(c);
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
  const burn = (x: number, y: number) => {
    const i = y * grid.w + x;
    beams[i] = BEAM_TICKS;
    state.beamOwner[i] = c.owner + 1;
    state.beamRock[i] = 0;
    // A beam destroys a power-up that is already lying in the open.
    if (grid.cells[i] === Cell.Empty && state.items[i] !== Item.None) {
      state.items[i] = Item.None;
      state.events.push({ type: 'item_destroyed', tx: x, ty: y });
    }
  };
  burn(c.tx, c.ty);

  for (let d = 1; d <= 4; d++) {
    for (let r = 1; r <= c.range; r++) {
      const x = c.tx + DIR_DX[d] * r;
      const y = c.ty + DIR_DY[d] * r;
      if (!inBounds(grid, x, y)) break;
      const cell = cellAt(grid, x, y);
      if (cell === Cell.Pillar) break;
      if (cell === Cell.Rock) {
        // Break the rock first so a power-up under it is revealed, not burnt.
        grid.cells[y * grid.w + x] = Cell.Empty;
        beams[y * grid.w + x] = BEAM_TICKS;
        state.beamOwner[y * grid.w + x] = c.owner + 1;
        // Rock clearance: this beam opens the tile but does not hurt a Martian
        // flushed into it; that takes a second blast.
        state.beamRock[y * grid.w + x] = 1;
        state.events.push({ type: 'rock_broken', tx: x, ty: y });
        break;
      }
      burn(x, y);
      const other = chargeAt(state, x, y);
      if (other) queue.push(other); // chain reaction, same tick
    }
  }
}
