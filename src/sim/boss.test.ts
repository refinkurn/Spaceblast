import { describe, expect, it } from 'vitest';
import {
  BOSS_SPOUT, BOSS_TILE, BOSS_WAVES, BossKind, Cell, Dir, EVENT_WARNING_TICKS, FREEZE_TICKS, GRID_W, Item, Kind, LevelEvent,
  MAX_ARMOR, MAX_BOOTS, MAX_CHARGES, MAX_RANGE, TILE,
} from './constants';
import type { PlayerCommand } from './command';
import { bossIntervals, crossTiles } from './boss';
import { levelSpec } from './levels';
import { seedRng } from './rng';
import { step } from './sim';
import { createGame, type GameState, type SimEvent } from './state';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };
const SEC = 60;

/** Runs ticks and returns every event with the tick it happened on. */
function run(g: GameState, ticks: number, cmds: PlayerCommand[] = [idle]): { t: number; e: SimEvent }[] {
  const out: { t: number; e: SimEvent }[] = [];
  for (let i = 0; i < ticks && g.status === 'playing'; i++) {
    step(g, cmds);
    for (const e of g.events) out.push({ t: g.tick, e });
  }
  return out;
}

/** A boss level whose astronaut cannot be hurt, so only the boss's own clock matters. */
function bossLevel(level: number, seed = 1): GameState {
  const spec = levelSpec(level);
  const g = createGame(seed, { roster: spec.roster, rules: spec.rules, boss: spec.boss });
  g.players[0].shield = 1e9;
  return g;
}

const waveTicks = (evs: { t: number; e: SimEvent }[]) => evs.filter((x) => x.e.type === 'boss_wave').map((x) => x.t);

describe('boss levels', () => {
  it('sets up a solid, immune boss on the centre tile with no gate or roster', () => {
    const g = bossLevel(5);
    const [bx, by] = BOSS_TILE;
    expect(g.boss?.kind).toBe(BossKind.GooplingHive);
    expect(g.grid.cells[by * GRID_W + bx]).toBe(Cell.Pillar);
    expect(g.gate).toBe(-1);
    expect(g.martians).toHaveLength(0);
  });

  it('Goopling Hive: 3 waves of 3 Gooplings, 44 s -> 22 s -> 11 s', () => {
    const g = bossLevel(5);
    const evs = run(g, 3 * 60 * SEC);
    const w = EVENT_WARNING_TICKS + 1;
    expect(waveTicks(evs)).toEqual([w, w + 44 * SEC, w + 66 * SEC]);
    expect(g.martians.length).toBe(BOSS_WAVES * BOSS_SPOUT);
    const dead = evs.find((x) => x.e.type === 'boss_defeated');
    expect(dead?.t).toBe(w + 77 * SEC);
    expect(g.status).toBe('cleared');
  });

  it('Darkness Hive: Gooplings plus a Blackout each wave, 40 s -> 20 s -> 10 s', () => {
    const g = bossLevel(10);
    const evs = run(g, 3 * 60 * SEC);
    const w = EVENT_WARNING_TICKS + 1;
    expect(waveTicks(evs)).toEqual([w, w + 40 * SEC, w + 60 * SEC]);
    const blackouts = evs.filter((x) => x.e.type === 'blackout_start').map((x) => x.t);
    expect(blackouts).toHaveLength(3);
    // Each Blackout lands with its wave.
    for (const [i, t] of waveTicks(evs).entries()) expect(Math.abs(blackouts[i] - t)).toBeLessThanOrEqual(1);
    expect(evs.find((x) => x.e.type === 'boss_defeated')?.t).toBe(w + 70 * SEC);
  });

  it('Maze Master: Maze Shift, a cross blast and Gooplings each wave, 36 -> 18 -> 9 s', () => {
    const g = bossLevel(15);
    const evs = run(g, 3 * 60 * SEC);
    const w = EVENT_WARNING_TICKS + 1;
    expect(waveTicks(evs)).toEqual([w, w + 36 * SEC, w + 54 * SEC]);
    expect(evs.filter((x) => x.e.type === 'boss_cross')).toHaveLength(3);
    expect(evs.filter((x) => x.e.type === 'maze_shift')).toHaveLength(3);
    expect(evs.find((x) => x.e.type === 'boss_defeated')?.t).toBe(w + 63 * SEC);
  });

  it('cross blast covers the whole row and column, and the boss Gooplings are immune to it', () => {
    const g = bossLevel(15, 3);
    const evs = run(g, EVENT_WARNING_TICKS + 2);
    const cross = evs.find((x) => x.e.type === 'boss_cross');
    expect(cross).toBeDefined();
    if (cross?.e.type !== 'boss_cross') return;
    const [bx, by] = BOSS_TILE;
    for (const i of cross.e.tiles) expect(i % GRID_W === bx || Math.floor(i / GRID_W) === by).toBe(true);
    const tiles = cross.e.tiles;
    expect(tiles).toEqual(crossTiles(g, g.boss!));
    // Put every Goopling on the cross while the beams are live: none dies.
    g.martians.forEach((m, n) => { const i = tiles[n]; m.x = (i % GRID_W) * TILE; m.y = Math.floor(i / GRID_W) * TILE; });
    g.freeze = 10;
    run(g, 2);
    expect(g.martians.every((m) => m.alive)).toBe(true);
  });

  it('hurts an astronaut standing in the cross', () => {
    const g = bossLevel(15);
    g.players[0].shield = 0;
    const [bx] = BOSS_TILE;
    g.players[0].x = bx * TILE; g.players[0].y = 0; // top of the boss's column
    run(g, EVENT_WARNING_TICKS + 2);
    expect(g.players[0].alive).toBe(false);
  });

  it('is never hurt by the astronaut\'s charges', () => {
    const g = bossLevel(5);
    const [bx, by] = BOSS_TILE;
    g.charges.push({ id: 50, owner: 0, tx: bx, ty: by - 1, fuse: 5, range: 5 });
    run(g, 10);
    expect(g.boss?.alive).toBe(true);
    expect(g.grid.cells[by * GRID_W + bx]).toBe(Cell.Pillar);
  });

  it('every boss has 3 waves, each wait half the one before, and no wait over 50 s', () => {
    expect(bossIntervals(BossKind.GooplingHive)).toEqual([44, 22, 11].map((s) => s * SEC));
    expect(bossIntervals(BossKind.DarknessHive)).toEqual([40, 20, 10].map((s) => s * SEC));
    expect(bossIntervals(BossKind.MazeMaster)).toEqual([36, 18, 9].map((s) => s * SEC));
    for (const kind of [BossKind.GooplingHive, BossKind.DarknessHive, BossKind.MazeMaster]) {
      for (const wait of bossIntervals(kind)) expect(wait).toBeLessThanOrEqual(50 * SEC);
    }
    for (const k of [BossKind.GooplingHive, BossKind.DarknessHive, BossKind.MazeMaster]) {
      const w = bossIntervals(k);
      expect(w).toHaveLength(BOSS_WAVES);
      for (let i = 1; i < w.length; i++) expect(w[i] * 2).toBe(w[i - 1]);
    }
  });
});

describe('level 20: Renegade Pilot duel', () => {
  function duel(seed = 2): GameState {
    const spec = levelSpec(20);
    return createGame(seed, { rules: spec.rules, rival: spec.rival });
  }

  it('is a 1v1 with no Martians or gate, and the grid keeps shifting', () => {
    const g = duel();
    expect(g.players).toHaveLength(2);
    expect(g.martians).toHaveLength(0);
    expect(g.gate).toBe(-1);
    expect(g.rules.mazeShift).toBe(true);
    expect(g.players[1].lives).toBe(1);
  });

  it('defeating the rival clears story mode; losing every life is game over', () => {
    const win = duel();
    win.charges.push({ id: 9, owner: 0, tx: 12, ty: 10, fuse: 1, range: 1 });
    run(win, 3, [idle, idle]);
    expect(win.status).toBe('cleared');

    const lose = duel();
    lose.players[0].lives = 1;
    lose.charges.push({ id: 9, owner: 1, tx: 0, ty: 0, fuse: 1, range: 1 });
    run(lose, 3, [idle, idle]);
    expect(lose.status).toBe('game_over');
  });
});

describe('rock clearance', () => {
  function arena(): GameState {
    const g = createGame(1, { martians: 0 });
    g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
    g.items.fill(0);
    g.gate = -1;
    g.players[0].shield = 1e9;
    return g;
  }

  it('a Martian flushed into a just-blasted rock tile survives; a second blast gets it', () => {
    const g = arena();
    g.grid.cells[4 * GRID_W + 2] = Cell.Rock;
    g.charges.push({ id: 1, owner: 0, tx: 0, ty: 4, fuse: 1, range: 2 });
    const m = { id: 1, kind: Kind.Goopling, x: 3 * TILE, y: 4 * TILE, dir: Dir.None, alive: true, timer: 0, hidden: false, built: 0 } as const;
    g.martians.push({ ...m });
    g.freeze = 1000;
    run(g, 1); // rock at (2,4) breaks
    expect(g.grid.cells[4 * GRID_W + 2]).toBe(Cell.Empty);
    g.martians[0].x = 2 * TILE; // flushed out into the opened tile while the beam is still live
    run(g, 5);
    expect(g.martians[0].alive).toBe(true);
    // A second blast over the same tile is a normal beam.
    g.charges.push({ id: 2, owner: 0, tx: 1, ty: 4, fuse: 1, range: 1 });
    run(g, 2);
    expect(g.martians[0].alive).toBe(false);
  });

  it('a normal beam still defeats a Martian in the open', () => {
    const g = arena();
    g.martians.push({ id: 1, kind: Kind.Goopling, x: 2 * TILE, y: 4 * TILE, dir: Dir.None, alive: true, timer: 0, hidden: false, built: 0 });
    g.freeze = 1000;
    g.charges.push({ id: 1, owner: 0, tx: 0, ty: 4, fuse: 1, range: 2 });
    run(g, 2);
    expect(g.martians[0].alive).toBe(false);
  });
});

describe('power-ups', () => {
  it('stack by 1 per pickup up to their caps', () => {
    const g = createGame(1, { martians: 0 });
    const p = g.players[0];
    const pick = (item: Item, times: number) => {
      for (let n = 0; n < times; n++) {
        g.grid.cells[p.y / TILE * GRID_W + p.x / TILE] = Cell.Empty;
        g.items[p.y / TILE * GRID_W + p.x / TILE] = item;
        step(g, [idle]);
      }
    };
    expect([p.maxCharges, p.range, p.boots, p.armor]).toEqual([1, 1, 0, 0]); // baseline
    pick(Item.BeamRange, 9);
    pick(Item.ExtraCharge, 9);
    pick(Item.JetBoots, 9);
    pick(Item.OxygenVest, 9);
    expect([p.range, p.maxCharges, p.boots, p.armor]).toEqual([MAX_RANGE, MAX_CHARGES, MAX_BOOTS, MAX_ARMOR]);
    expect([MAX_RANGE, MAX_CHARGES, MAX_BOOTS]).toEqual([5, 5, 5]);
    pick(Item.FreezePulse, 1);
    expect(g.freeze).toBe(FREEZE_TICKS - 1);
    expect(FREEZE_TICKS).toBe(3 * SEC);
  });
});

describe('Sector 4 aggression', () => {
  it('Martians close in on the astronaut faster than in earlier sectors', () => {
    const avgDistance = (aggressive: boolean) => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = createGame(seed, { roster: [Kind.Goopling, Kind.Goopling, Kind.Goopling] });
        g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
        g.rules = { ...g.rules, aggressive };
        g.rng = seedRng(seed);
        g.players[0].shield = 1e9;
        run(g, 20 * SEC);
        for (const m of g.martians) total += Math.abs(m.x - g.players[0].x) + Math.abs(m.y - g.players[0].y);
      }
      return total;
    };
    expect(avgDistance(true)).toBeLessThan(avgDistance(false) * 0.8);
  });
});

it('Blackout and Maze Shift events still run on a boss level only when the boss starts them', () => {
  const g = bossLevel(10);
  const evs = run(g, 10);
  expect(evs.some((x) => x.e.type === 'event_warning' && x.e.event === LevelEvent.Blackout)).toBe(true); // first wave's warning
  expect(g.rules.blackout).toBe(false);
});
