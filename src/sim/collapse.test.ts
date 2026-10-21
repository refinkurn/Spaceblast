import { describe, expect, it } from 'vitest';
import { Bot } from '../input/bot';
import { Cell, COLLAPSE_EVERY, COLLAPSE_WARNING_TICKS, EVENT_WARNING_TICKS, GRID_H, GRID_W, Item, LevelEvent, TILE } from './constants';
import { NO_COMMAND } from './command';
import { collapseOrder } from './collapse';
import { dangerMap, SAFE } from './danger';
import { NO_EVENTS } from './levels';
import { hashState, step } from './sim';
import { createGame } from './state';

const idle = [NO_COMMAND, NO_COMMAND, NO_COMMAND, NO_COMMAND];

describe('arena collapse', () => {
  it('spirals in from the top-left corner and covers every tile once', () => {
    const order = collapseOrder(GRID_W, GRID_H);
    expect(order.length).toBe(GRID_W * GRID_H);
    expect(new Set(order).size).toBe(GRID_W * GRID_H);
    expect(order.slice(0, 3)).toEqual([0, 1, 2]);
    expect(order[GRID_W]).toBe(2 * GRID_W - 1); // down the right edge
    // 13x11 ends on the middle row (the innermost "ring" is a 3-tile line).
    expect(Math.floor(order.at(-1)! / GRID_W)).toBe(Math.floor(GRID_H / 2));
  });

  it('does not start before the clock runs out', () => {
    const s = createGame(3, { mode: 'battle', roundTicks: 120 });
    for (let t = 0; t < 119; t++) step(s, idle);
    expect(s.events.some((e) => e.type === 'tile_collapsed')).toBe(false);
    expect(s.grid.cells[0]).not.toBe(Cell.Pillar);
  });

  it('drops a block every 0.2 s, crushing whoever stands there', () => {
    const s = createGame(3, { mode: 'battle', players: 3, roundTicks: 60 });
    s.players[0].armor = 3;
    s.players[0].shield = 1000; // nothing saves you from a falling block
    s.items[1] = Item.BeamRange;
    let fell = 0;
    for (let t = 0; t < 60 + COLLAPSE_EVERY * 2 + 1 && s.status === 'playing'; t++) {
      step(s, idle);
      fell += s.events.filter((e) => e.type === 'tile_collapsed').length;
    }
    expect(fell).toBe(3);
    expect(s.grid.cells[0]).toBe(Cell.Pillar);
    expect(s.items[1]).toBe(Item.None);
    expect(s.players[0].alive).toBe(false); // spawn tile (0,0) fell first
    expect(s.status).toBe('playing');
  });

  it('an astronaut only grazed by a block is pushed off it, never left inside it', () => {
    const s = createGame(3, { mode: 'battle', roundTicks: 1 });
    const p = s.players[0];
    p.x = 750; // 0.75 tile from tile (0,0): too far to be crushed when it falls first
    step(s, idle); // clock hits 0
    step(s, idle); // (0,0) falls
    expect(s.grid.cells[0]).toBe(Cell.Pillar);
    expect(p.alive).toBe(true);
    expect(p.x).toBe(TILE); // fully on (1,0), so it can't walk back into the block
    // Before the fix it could stand inside the fallen block and survive the whole collapse.
    const left = { dir: 3 as const, alt: 0 as const, place: false };
    for (let t = 0; t < 10; t++) step(s, [left, NO_COMMAND]);
    expect(p.x).toBe(TILE);
  });

  it('the last one standing wins', () => {
    const s = createGame(3, { mode: 'battle', roundTicks: 10 });
    for (let t = 0; t < 12; t++) step(s, idle);
    expect(s.status).toBe('round_over');
    expect(s.winner).toBe(1);
  });

  it('a round can no longer end in a time-out draw', () => {
    const s = createGame(8, { mode: 'battle', players: 4, roundTicks: 30 });
    for (let t = 0; t < 60 * 60 && s.status === 'playing'; t++) step(s, idle);
    expect(s.status).toBe('round_over');
  });

  it('bots see the next falling blocks as danger and step away', () => {
    const s = createGame(5, { mode: 'battle', roundTicks: 200 });
    expect(dangerMap(s)[0]).toBe(SAFE);
    for (let t = 0; t < 120; t++) step(s, idle);
    expect(dangerMap(s)[0]).not.toBe(SAFE);
    // A bot standing in the corner walks out before the block lands.
    const s2 = createGame(5, { mode: 'battle', roundTicks: 90 });
    s2.grid.cells[1] = Cell.Empty; s2.grid.cells[GRID_W] = Cell.Empty;
    const bot = new Bot(0, 5);
    for (let t = 0; t < 91 && s2.status === 'playing'; t++) step(s2, [bot.think(s2), NO_COMMAND]);
    expect(s2.players[0].alive).toBe(true);
    expect(Math.abs(s2.players[0].x) + Math.abs(s2.players[0].y)).toBeGreaterThan(TILE / 2);
  });

  it('battle can use Maze Shift and Blackout, and stays deterministic', () => {
    const rules = { ...NO_EVENTS, mazeShift: true, blackout: true };
    const run = () => {
      const s = createGame(77, { mode: 'battle', players: 3, rules, roundTicks: 60 * 60 });
      const kinds = new Set<string>();
      for (let t = 0; t < 60 * 60; t++) {
        step(s, idle);
        for (const e of s.events) kinds.add(e.type);
      }
      return { hash: hashState(s), kinds };
    };
    const a = run(), b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.kinds.has('event_warning') && (a.kinds.has('maze_shift') || a.kinds.has('blackout_start'))).toBe(true);
  });
});

describe('events and the collapse', () => {
  const rules = { ...NO_EVENTS, mazeShift: true, blackout: true };

  it('a Blackout never overlaps the collapse warning or the collapse', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const secs of [60, 90, 120]) {
        const s = createGame(seed, { mode: 'battle', players: 4, rules, roundTicks: secs * 60 });
        for (let t = 0; t < secs * 60 + 300 && s.status === 'playing'; t++) {
          step(s, idle);
          const dark = s.event === LevelEvent.Blackout && (s.eventWarning > 0 || s.eventActive > 0);
          if (s.timeLeft <= COLLAPSE_WARNING_TICKS) expect(dark, `seed ${seed}, ${secs}s, tick ${s.tick}`).toBe(false);
        }
      }
    }
  });

  it('no new event starts once the collapse is close', () => {
    const s = createGame(9, { mode: 'battle', rules, roundTicks: 60 * 60 });
    let lastWarning = -1;
    for (let t = 0; t < 60 * 60 + 200 && s.status === 'playing'; t++) {
      step(s, idle);
      if (s.events.some((e) => e.type === 'event_warning')) lastWarning = s.timeLeft;
    }
    expect(lastWarning === -1 || lastWarning > COLLAPSE_WARNING_TICKS + EVENT_WARNING_TICKS).toBe(true);
  });
});
