import { describe, expect, it } from 'vitest';
import { Cell, Dir, FUSE_TICKS, GRID_W } from '../sim/constants';
import type { PlayerCommand } from '../sim/command';
import { step } from '../sim/sim';
import { createGame } from '../sim/state';
import { dangerMap } from '../sim/danger';
import { Bot, type BotSkill } from './bot';

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

  it('keeps playing when time runs out: the arena collapses instead', () => {
    const g = createGame(1, { mode: 'battle' });
    g.timeLeft = 2;
    step(g, [idle, idle]);
    step(g, [idle, idle]);
    step(g, [idle, idle]);
    expect(g.events.some((e) => e.type === 'tile_collapsed')).toBe(true);
  });
});

describe('bot difficulty', () => {
  /** Plays `rounds` bot-vs-bot rounds; returns player 0's wins and losses. */
  function duel(a: BotSkill, b: BotSkill, rounds: number) {
    let wins = 0, losses = 0;
    for (let seed = 1; seed <= rounds; seed++) {
      const g = createGame(seed, { mode: 'battle', roundTicks: 60 * 60 });
      const bots = [new Bot(0, seed, a), new Bot(1, seed, b)];
      while (g.status === 'playing') step(g, bots.map((x) => x.think(g)));
      if (g.winner === 0) wins++;
      if (g.winner === 1) losses++;
    }
    return { wins, losses };
  }

  it('normal beats easy and hard beats normal (bot-vs-bot rounds often end in draws)', () => {
    const ne = duel('normal', 'easy', 12);
    expect(ne.wins).toBeGreaterThanOrEqual(8);
    expect(ne.wins).toBeGreaterThan(ne.losses * 3);
    const hn = duel('hard', 'normal', 12);
    expect(hn.wins).toBeGreaterThan(hn.losses);
  }, 30000);

  it('an easy bot rarely blows itself up against an idle player', () => {
    let selfKills = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = createGame(seed, { mode: 'battle', roundTicks: 40 * 60 });
      const bot = new Bot(1, seed, 'easy');
      g.players[0].shield = 1e6; // the idle player can't be hit
      while (g.status === 'playing' && g.timeLeft > 0) step(g, [idle, bot.think(g)]);
      if (!g.players[1].alive) selfKills++;
    }
    expect(selfKills).toBeLessThanOrEqual(3);
  });
});

describe('smooth movement', () => {
  // A wobble is moving one way, then back, then forward again on three ticks in a row.
  // Bots used to wobble on about 1 tick in 4 (steering back to a tile centre they overshot).
  it('bots almost never wobble back and forth', () => {
    for (const skill of ['easy', 'normal', 'hard'] as BotSkill[]) {
      let wobbles = 0, ticks = 0;
      for (let seed = 1; seed <= 4; seed++) {
        const g = createGame(seed, { mode: 'battle' });
        const bots = [new Bot(0, seed, skill), new Bot(1, seed, skill)];
        const moves: [number, number][][] = [[], []];
        for (let t = 0; t < 2400 && g.status === 'playing'; t++) {
          const before = g.players.map((p) => [p.x, p.y]);
          step(g, bots.map((b) => b.think(g)));
          g.players.forEach((p, i) => {
            if (!p.alive) return;
            ticks++;
            const m = moves[i];
            m.push([Math.sign(p.x - before[i][0]), Math.sign(p.y - before[i][1])]);
            const back = (a: [number, number], b: [number, number]) => (a[0] !== 0 || a[1] !== 0) && a[0] === -b[0] && a[1] === -b[1];
            if (m.length >= 3 && back(m[m.length - 3], m[m.length - 2]) && back(m[m.length - 2], m[m.length - 1])) wobbles++;
          });
        }
      }
      expect(wobbles / ticks, skill).toBeLessThan(0.005);
    }
  }, 30000);
});
