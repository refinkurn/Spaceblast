import { describe, expect, it } from 'vitest';
import { BEAM_FADE_TICKS, BossKind, Cell, Dir, FUSE_TICKS, Item, ROCK_DROPS, TILE } from './constants';
import type { PlayerCommand } from './command';
import { gemsCollected, placeGate, rockDrop } from './items';
import { seedRng } from './rng';
import { hashState, step } from './sim';
import { createGame, type GameState } from './state';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };

/** Empty survival arena (pillars only), no Martians, no gate. */
function arena(mode: 'survival' | 'battle' = 'survival'): GameState {
  const g = createGame(1, { martians: 0, mode });
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  g.items.fill(0);
  g.gate = -1;
  for (const p of g.players) p.shield = 1e6;
  return g;
}

describe('rock drop table', () => {
  it('adds up to 100: empty 38, gem 30, Extra Charge 8, Beam Range+ 7, Speed Boost 10, Oxygen Vest 5, Freeze Pulse 2', () => {
    expect(ROCK_DROPS.reduce((n, [, w]) => n + w, 0)).toBe(100);
    const story = new Map<number, number>();
    const battle = new Map<number, number>();
    for (let roll = 0; roll < 100; roll++) {
      const s = rockDrop(roll, false), b = rockDrop(roll, true);
      story.set(s, (story.get(s) ?? 0) + 1);
      battle.set(b, (battle.get(b) ?? 0) + 1);
    }
    expect(Object.fromEntries(story)).toEqual({
      [Item.None]: 38, [Item.Gem]: 30, [Item.ExtraCharge]: 8, [Item.BeamRange]: 7, [Item.JetBoots]: 10, [Item.OxygenVest]: 5, [Item.FreezePulse]: 2,
    });
    // Battle: the gem share stays empty and Freeze Pulse becomes Extra Charge.
    expect(Object.fromEntries(battle)).toEqual({
      [Item.None]: 68, [Item.ExtraCharge]: 10, [Item.BeamRange]: 7, [Item.JetBoots]: 10, [Item.OxygenVest]: 5,
    });
  });

  it('hides the gate under a rock with no item, gems included, when there is one', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = createGame(seed);
      expect(g.gate).toBeGreaterThanOrEqual(0);
      expect(g.items[g.gate]).toBe(Item.None);
    }
    // Every rock hides a gem but one: the gate goes under that one.
    const g = arena();
    g.grid.cells[2] = Cell.Rock; g.grid.cells[4] = Cell.Rock; g.grid.cells[6] = Cell.Rock;
    g.items[2] = Item.Gem; g.items[6] = Item.Gem;
    g.rng = seedRng(9);
    placeGate(g);
    expect(g.gate).toBe(4);
  });

  it('online battle grids stay identical for the same seed', () => {
    const a = createGame(77, { mode: 'battle', arena: 'random' });
    const b = createGame(77, { mode: 'battle', arena: 'random' });
    expect(hashState(a)).toBe(hashState(b));
    expect([...a.items].includes(Item.Gem)).toBe(false);
  });
});

describe('gems (Star Dots)', () => {
  it('are picked up on touch: the counter goes up, an item_picked event says Gem, power-ups stay the same', () => {
    const g = arena();
    g.items[1] = Item.Gem; // tile (1, 0), next to the spawn
    const before = { ...g.players[0] };
    for (let t = 0; t < 30 && g.items[1] !== Item.None; t++) step(g, [{ ...idle, dir: Dir.Right }]);
    const p = g.players[0];
    expect(g.items[1]).toBe(Item.None);
    expect(p.gems).toBe(1);
    expect(gemsCollected(g)).toBe(1);
    expect({ range: p.range, maxCharges: p.maxCharges, boots: p.boots, armor: p.armor })
      .toEqual({ range: before.range, maxCharges: before.maxCharges, boots: before.boots, armor: before.armor });
    expect(g.freeze).toBe(0);
  });

  it('emits item_picked with item Gem and the tile', () => {
    const g = arena();
    g.items[1] = Item.Gem;
    const seen: unknown[] = [];
    for (let t = 0; t < 30; t++) {
      step(g, [{ ...idle, dir: Dir.Right }]);
      seen.push(...g.events.filter((e) => e.type === 'item_picked'));
    }
    expect(seen).toEqual([{ type: 'item_picked', id: 0, item: Item.Gem, tx: 1, ty: 0 }]);
  });

  it('survive a beam that burns a power-up next to them', () => {
    const g = arena();
    g.players[0].x = 4 * TILE; g.players[0].y = 2 * TILE; // out of the way
    g.players[0].range = 3;
    g.charges.push({ id: 99, owner: 0, tx: 6, ty: 0, fuse: 1, range: 3 });
    g.items[5] = Item.Gem; // (5, 0)
    g.items[7] = Item.BeamRange; // (7, 0)
    step(g, [idle]);
    expect(g.items[5]).toBe(Item.Gem);
    expect(g.items[7]).toBe(Item.None);
    expect(g.events).toContainEqual({ type: 'item_destroyed', tx: 7, ty: 0 });
    expect(g.events).not.toContainEqual({ type: 'item_destroyed', tx: 5, ty: 0 });
  });

  it('survive a boss cross blast too', () => {
    const g = createGame(3, { boss: BossKind.MazeMaster });
    const [bx, by] = [6, 5];
    const gemTile = by * g.grid.w + 0, itemTile = 0 * g.grid.w + bx;
    g.grid.cells[gemTile] = Cell.Empty; g.grid.cells[itemTile] = Cell.Empty;
    g.items[gemTile] = Item.Gem; g.items[itemTile] = Item.JetBoots;
    g.players[0].shield = 1e6;
    for (let t = 0; t < 600 && !g.events.some((e) => e.type === 'boss_cross'); t++) step(g, [idle]);
    expect(g.events.some((e) => e.type === 'boss_cross')).toBe(true);
    expect(g.items[gemTile]).toBe(Item.Gem);
    expect(g.items[itemTile]).toBe(Item.None);
  });

  it('are part of the state hash', () => {
    const a = arena(), b = arena();
    expect(hashState(a)).toBe(hashState(b));
    b.players[0].gems = 1;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('keep counting through a knock-out', () => {
    const g = arena();
    g.players[0].gems = 4;
    g.players[0].shield = 0;
    g.charges.push({ id: 1, owner: 0, tx: 0, ty: 0, fuse: 1, range: 1 });
    for (let t = 0; t < FUSE_TICKS + BEAM_FADE_TICKS; t++) step(g, [idle]);
    expect(g.players[0].lives).toBeLessThan(3);
    expect(g.players[0].gems).toBe(4);
  });
});
