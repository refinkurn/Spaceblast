import {
  BOOTS_SPEED, Cell, FREEZE_TICKS, Item, MAX_ARMOR, MAX_BOOTS, MAX_CHARGES, MAX_RANGE, PLAYER_SPEED, ROCK_DROPS,
} from './constants';
import { cellAt } from './grid';
import { nextInt } from './rng';
import { playerTile, type GameState, type Player } from './state';

// Power-ups and gems (Star Dots) hidden under rocks, and the Warp Gate.

/** The item a rock hides for a roll in [0, 100) (ROCK_DROPS). */
export function rockDrop(roll: number, battle: boolean): Item {
  let r = roll;
  for (const [item, weight] of ROCK_DROPS) {
    if (r < weight) {
      // Battle: no gems, and Freeze Pulse (only useful against Martians) becomes Extra Charge.
      if (battle && item === Item.Gem) return Item.None;
      if (battle && item === Item.FreezePulse) return Item.ExtraCharge;
      return item;
    }
    r -= weight;
  }
  return Item.None;
}

/** One roll per rock, in tile order. */
export function placeItems(state: GameState): void {
  const { grid, items } = state;
  const battle = state.mode === 'battle';
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] !== Cell.Rock) continue;
    items[i] = rockDrop(nextInt(state, 100), battle);
  }
}

/** Hides the Warp Gate under a random rock, preferring one without an item (gems count as items). */
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

/** A revealed power-up or gem on a tile (not under a rock). */
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
    case Item.OxygenVest: p.armor = Math.min(MAX_ARMOR, p.armor + 1); break;
    case Item.Gem: p.gems++; break;
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

/** Gems every astronaut has picked up (Story score). */
export function gemsCollected(state: GameState): number {
  return state.players.reduce((n, p) => n + p.gems, 0);
}
