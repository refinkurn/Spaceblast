import { describe, expect, it } from 'vitest';
import { Bot } from '../input/bot';
import { ARENAS, ARENA_IDS, arenaPillar } from './arenas';
import { Cell, Dir, GOD_SHIELD, GRID_H, GRID_W, LevelEvent, SPAWNS } from './constants';
import type { PlayerCommand } from './command';
import { collapseOrder, updateCollapse } from './collapse';
import { isWalkable } from './grid';
import { warn } from './level_events';
import { LEVEL_COUNT, NO_EVENTS, levelSpec } from './levels';
import { respawnTile } from './lives';
import { step } from './sim';
import { createGame, playerTile, type GameState } from './state';

// Rules that used to rely on odd/odd pillars, played on every layout.

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };
const ALL = ARENAS.map((a) => a.id);
const pillarSet = (id: number, extra: number[] = []) => {
  const out = new Set(extra);
  for (let i = 0; i < GRID_W * GRID_H; i++) if (arenaPillar(id, i % GRID_W, Math.floor(i / GRID_W))) out.add(i);
  return out;
};
const solidNow = (g: GameState) => new Set([...g.grid.cells.keys()].filter((i) => g.grid.cells[i] === Cell.Pillar));
const tileOf = (m: { x: number; y: number }) => playerTile(m)[1] * GRID_W + playerTile(m)[0];

describe('story levels on their layouts', () => {
  it('Martians, Builders, portals, Maze Shift and the wandering gate never add or remove a pillar', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const spec = levelSpec(level);
      let shifts = 0, built = 0;
      for (let seed = 1; seed <= 3; seed++) {
        const g = createGame(seed, { roster: spec.roster, rules: spec.rules, boss: spec.boss, rival: spec.rival, arena: spec.arena });
        g.players[0].shield = GOD_SHIELD; // the hero stands still and survives
        const solid = pillarSet(spec.arena, g.boss ? [g.boss.tile] : []);
        for (let t = 0; t < 60 * 70 && g.status === 'playing'; t++) {
          step(g, [idle, idle]);
          shifts += g.events.filter((e) => e.type === 'maze_shift').length;
          built += g.events.filter((e) => e.type === 'rock_built').length;
          for (const m of g.martians) if (m.alive && !m.hidden) expect(g.grid.cells[tileOf(m)], `level ${level} martian`).not.toBe(Cell.Pillar);
          for (const p of g.portals) {
            expect(g.grid.cells[p.from]).not.toBe(Cell.Pillar);
            expect(g.grid.cells[p.to]).not.toBe(Cell.Pillar);
          }
          if (g.gate >= 0) expect(g.grid.cells[g.gate], `level ${level} gate`).not.toBe(Cell.Pillar);
        }
        expect(solidNow(g), `level ${level} seed ${seed}`).toEqual(solid);
      }
      // The rules under test really ran (events are random, so summed over the seeds).
      if (spec.rules.mazeShift && !spec.rival) expect(shifts, `level ${level}`).toBeGreaterThan(0);
      if (level >= 16 && level < 20) expect(built, `level ${level}`).toBeGreaterThan(0);
    }
  }, 60000);

  it.each(ALL)('Maze Shift on layout %i moves only rocks, onto open floor', (id) => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame(seed, { martians: 0, rules: { ...NO_EVENTS, mazeShift: true }, arena: id });
      const solid = pillarSet(id);
      warn(g, LevelEvent.MazeShift);
      for (const i of g.shiftAdd) expect(g.grid.cells[i]).toBe(Cell.Empty);
      for (let t = 0; t < 200; t++) step(g, [idle]);
      expect(solidNow(g)).toEqual(solid);
    }
  });
});

describe('battle on every layout', () => {
  it.each(ALL)('the collapse on layout %i drops every non-pillar tile once, in spiral order', (id) => {
    const g = createGame(4, { mode: 'battle', roundTicks: 1, arena: id });
    g.timeLeft = 0;
    const fallen: number[] = [];
    for (let t = 0; t < 60 * 60; t++) {
      updateCollapse(g);
      for (const e of g.events) if (e.type === 'tile_collapsed') fallen.push(e.ty * GRID_W + e.tx);
      g.events = [];
    }
    const solid = pillarSet(id);
    expect(fallen).toEqual(collapseOrder(GRID_W, GRID_H).filter((i) => !solid.has(i)));
    expect([...g.grid.cells].every((c) => c === Cell.Pillar)).toBe(true);
  });

  it.each(ALL)('respawn on layout %i lands on a free tile next to open floor', (id) => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame(seed, { martians: 0, arena: id });
      const p = g.players[0];
      const [sx, sy] = SPAWNS[0];
      g.grid.cells[sy * GRID_W + sx] = Cell.Rock; // spawn taken (Maze Shift, a Builder)
      const [x, y] = respawnTile(g, p);
      expect(isWalkable(g.grid, x, y)).toBe(true);
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWalkable(g.grid, x + dx, y + dy))).toBe(true);
      expect(Math.abs(x - sx) + Math.abs(y - sy)).toBeLessThanOrEqual(2);
    }
  });

  it.each(ARENA_IDS)('a bot on layout %i escapes its own charges and breaks rocks', (id) => {
    let selfKnockouts = 0, placed = 0, rocks = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const g = createGame(seed, { mode: 'battle', arena: id });
      g.players[0].shield = 1e6;
      const bot = new Bot(1, seed);
      for (let t = 0; t < 1500 && g.status === 'playing'; t++) {
        step(g, [idle, bot.think(g)]);
        placed += g.events.filter((e) => e.type === 'charge_placed').length;
        rocks += g.events.filter((e) => e.type === 'rock_broken').length;
        if (g.events.some((e) => e.type === 'player_died' && e.id === 1)) selfKnockouts++;
      }
    }
    expect(placed).toBeGreaterThan(20);
    expect(rocks).toBeGreaterThan(20);
    expect(selfKnockouts).toBeLessThanOrEqual(2);
  }, 30000);

  it.each(ARENA_IDS)('four bots on layout %i always finish the round', (id) => {
    for (let seed = 1; seed <= 4; seed++) {
      const g = createGame(seed, { mode: 'battle', players: 4, roundTicks: 60 * 30, arena: id });
      const bots = [0, 1, 2, 3].map((i) => new Bot(i, seed, 'hard'));
      for (let t = 0; t < 60 * 70 && g.status === 'playing'; t++) step(g, bots.map((b) => b.think(g)));
      expect(g.status, `seed ${seed}`).toBe('round_over');
      // Nobody ever stood inside a pillar.
      for (const p of g.players) if (p.alive) expect(g.grid.cells[tileOf(p)]).not.toBe(Cell.Pillar);
    }
  }, 30000);

  it('online rooms on random arenas replay identically', () => {
    const play = (seed: number) => {
      const g = createGame(seed, { mode: 'battle', players: 2, arena: 'random' });
      const bots = [new Bot(0, seed), new Bot(1, seed)];
      for (let t = 0; t < 900; t++) step(g, bots.map((b) => b.think(g)));
      return [g.arena, g.tick, g.players[0].x, g.players[1].y, g.charges.length, [...g.grid.cells].join('')];
    };
    for (const seed of [11, 12, 13]) expect(play(seed)).toEqual(play(seed));
  });
});
