import {
  BOOTS_SPEED, Cell, FREEZE_TICKS, ITEM_ONE_IN, Item, MAX_BOOTS, MAX_CHARGES, MAX_RANGE, PLAYER_SPEED, VEST_TICKS,
} from './constants';
import { cellAt } from './grid';
import { nextInt } from './rng';
import { playerTile, type GameState, type Player } from './state';

// Power-ups hidden under rocks, and the Warp Gate.

/** Out of 10: 3 Beam Range+, 3 Extra Charge, 2 Jet Boots, 1 Oxygen Vest, 1 Freeze Pulse. */
const ITEM_TABLE: Item[] = [
  Item.BeamRange, Item.BeamRange, Item.BeamRange,
  Item.ExtraCharge, Item.ExtraCharge, Item.ExtraCharge,
  Item.JetBoots, Item.JetBoots,
  Item.OxygenVest,
  Item.FreezePulse,
];

export function placeItems(state: GameState): void {
  const { grid, items } = state;
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] !== Cell.Rock) continue;
    if (nextInt(state, ITEM_ONE_IN) !== 0) continue;
    const item = ITEM_TABLE[nextInt(state, ITEM_TABLE.length)];
    // Freeze Pulse only matters with Martians, so battles roll Extra Charge instead.
    items[i] = item === Item.FreezePulse && state.mode === 'battle' ? Item.ExtraCharge : item;
  }
}

/** Hides the Warp Gate under a random rock, preferring one without a power-up. */
export function placeGate(state: GameState): void {
  const rocks: number[] = [];
  state.grid.cells.forEach((c, i) => { if (c === Cell.Rock) rocks.push(i); });
  if (rocks.length === 0) return;
  const plain = rocks.filter((i) => state.items[i] === Item.None);
  const pool = plain.length > 0 ? plain : rocks;
  state.gate = pool[nextInt(state, pool.length)];
  state.items[state.gate] = Item.None;
}

export function playerSpeed(p: Player): number {
  return PLAYER_SPEED + BOOTS_SPEED * p.boots;
}

/** A revealed power-up on a tile (not under a rock). */
export function itemAt(state: GameState, tx: number, ty: number): Item {
  if (cellAt(state.grid, tx, ty) !== Cell.Empty) return Item.None;
  return state.items[ty * state.grid.w + tx] as Item;
}

export function pickUpItems(state: GameState, p: Player): void {
  const [tx, ty] = playerTile(p);
  const item = itemAt(state, tx, ty);
  if (item === Item.None) return;
  state.items[ty * state.grid.w + tx] = Item.None;
  switch (item) {
    case Item.BeamRange: p.range = Math.min(MAX_RANGE, p.range + 1); break;
    case Item.ExtraCharge: p.maxCharges = Math.min(MAX_CHARGES, p.maxCharges + 1); break;
    case Item.JetBoots: p.boots = Math.min(MAX_BOOTS, p.boots + 1); break;
    case Item.OxygenVest: p.vest = VEST_TICKS; break;
    case Item.FreezePulse:
      // A skill, not a charge: it fires the moment it is picked up.
      state.freeze = FREEZE_TICKS;
      state.events.push({ type: 'freeze', ticks: FREEZE_TICKS });
      break;
  }
  state.events.push({ type: 'item_picked', id: p.id, item, tx, ty });
}

/** Is the Warp Gate revealed (and so open)? Defeating the Martians is optional. */
export function gateOpen(state: GameState): boolean {
  return state.gate >= 0 && state.grid.cells[state.gate] === Cell.Empty;
}
