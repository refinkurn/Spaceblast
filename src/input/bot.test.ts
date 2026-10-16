import { describe, expect, it } from 'vitest';
import { Cell, Dir, FUSE_TICKS, GRID_W } from '../sim/constants';
import type { PlayerCommand } from '../sim/command';
import { step } from '../sim/sim';
import { createGame } from '../sim/state';
import { dangerMap } from '../sim/danger';
import { Bot } from './bot';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };

describe('danger map', () => {
  it('marks the blast cross with the fuse and leaves other tiles safe', () => {
    const g = createGame(1, { mode: 'battle' });
    g.grid.cells.fill(Cell.Empty);
    g.charges.push({ id: 9, owner: 0, tx: 4, ty: 4, fuse: 50, range: 1 });
    const d = dangerMap(g);
    expect(d[4 * GRID_W + 4]).toBe(50);
    expect(d[4 * GRID_W + 5]).toBe(50);
    expect(d[3 * GRID_W + 4]).toBe(50);
    expect(d[4 * GRID_W + 6]).toBe(-1);
    expect(d[5 * GRID_W + 5]).toBe(-1);
  });

  it('shortens fuses that a nearer blast will chain', () => {
    const g = createGame(1, { mode: 'battle' });
    g.grid.cells.fill(Cell.Empty);
    g.charges.push({ id: 1, owner: 0, tx: 4, ty: 4, fuse: 20, range: 1 });
    g.charges.push({ id: 2, owner: 1, tx: 5, ty: 4, fuse: 140, range: 1 });
    const d = dangerMap(g);
    expect(d[4 * GRID_W + 6]).toBe(20); // reached only by the chained charge
  });
});

describe('bot', () => {
  it('escapes its own charges', () => {
    let selfKnockouts = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame(seed, { mode: 'battle' });
      g.players[0].shield = 1e6; // an untouchable idle rival keeps the round going
      const bot = new Bot(1, seed);
      let placed = 0;
      for (let t = 0; t < 1500 && g.status === 'playing'; t++) {
        step(g, [idle, bot.think(g)]);
        placed += g.events.filter((e) => e.type === 'charge_placed').length;
        if (g.events.some((e) => e.type === 'player_died' && e.id === 1)) selfKnockouts++;
      }
      expect(placed).toBeGreaterThan(0);
    }
    expect(selfKnockouts).toBeLessThanOrEqual(2); // nearly always survives 20 x 25 s of play
  });

  it('breaks rocks and wins against an idle opponent most of the time', () => {
    let wins = 0, rocks = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame(seed, { mode: 'battle' });
      const bot = new Bot(1, seed);
      for (let t = 0; t < 60 * 90 && g.status === 'playing'; t++) {
        step(g, [idle, bot.think(g)]);
        rocks += g.events.filter((e) => e.type === 'rock_broken').length;
      }
      if (g.winner === 1) wins++;
    }
    expect(rocks).toBeGreaterThan(40);
    expect(wins).toBeGreaterThanOrEqual(10);
  });

  it('is deterministic for the same seed', () => {
    const play = () => {
      const g = createGame(3, { mode: 'battle' });
      const bot = new Bot(1, 3);
      for (let t = 0; t < FUSE_TICKS * 6; t++) step(g, [idle, bot.think(g)]);
      return [g.players[1].x, g.players[1].y, g.tick, g.charges.length];
    };
    expect(play()).toEqual(play());
  });
});

describe('battle rules', () => {
  it('ends the round when only one astronaut is left', () => {
    const g = createGame(1, { mode: 'battle' });
    expect(g.martians).toHaveLength(0);
    expect(g.gate).toBe(-1);
    g.players[0].alive = false;
    g.players[0].lives = 0;
    step(g, [idle, idle]);
    expect(g.status).toBe('round_over');
    expect(g.winner).toBe(1);
  });

  it('is a draw when time runs out', () => {
    const g = createGame(1, { mode: 'battle' });
    g.timeLeft = 2;
    step(g, [idle, idle]);
    step(g, [idle, idle]);
    expect(g.status).toBe('round_over');
    expect(g.winner).toBe(-1);
  });
});
