import { describe, expect, it } from 'vitest';
import { Bot } from '../input/bot';
import { Cell, COLLAPSE_EVERY, Dir, PLAYER_SPEED, START_HOLD_TICKS } from './constants';
import { NO_COMMAND, type PlayerCommand } from './command';
import { NO_EVENTS } from './levels';
import { hashState, step } from './sim';
import { createGame, holdLeft } from './state';

// Online rounds open with a 3-2-1-BLAST! hold played by the sim itself, so
// every phone holds for exactly the same ticks.

const right: PlayerCommand = { dir: Dir.Right, alt: Dir.None, place: false };
const down: PlayerCommand = { dir: Dir.Down, alt: Dir.None, place: false };
const placeRight: PlayerCommand = { ...right, place: true };

function online(roundTicks = 600) {
  return createGame(7, { mode: 'battle', players: 2, roundTicks, startHold: START_HOLD_TICKS });
}

describe('online start hold', () => {
  it('matches the client count: 4 steps of 0.6 s at 60 Hz', () => {
    expect(START_HOLD_TICKS).toBe(4 * 36);
  });

  it('defaults to no hold, so Story and offline Battle are unchanged', () => {
    expect(createGame(7).startHold).toBe(0);
    expect(createGame(7, { mode: 'battle' }).startHold).toBe(0);
    const g = createGame(7, { mode: 'battle', players: 2, roundTicks: 600 });
    step(g, [right, NO_COMMAND]);
    expect(g.players[0].x).toBe(PLAYER_SPEED);
    expect(g.timeLeft).toBe(599);
  });

  it('ignores moves and charges for the whole hold, without running the clock', () => {
    const g = online();
    const start = g.players.map((p) => [p.x, p.y]);
    for (let t = 0; t < START_HOLD_TICKS; t++) {
      step(g, [placeRight, { ...down, place: true }]);
      expect(g.events).toEqual([]);
    }
    expect(g.tick).toBe(START_HOLD_TICKS);
    expect(holdLeft(g)).toBe(0);
    expect(g.players.map((p) => [p.x, p.y])).toEqual(start);
    expect(g.charges).toHaveLength(0);
    expect(g.timeLeft).toBe(600);
    expect(g.status).toBe('playing');
  });

  it('lets everyone move on the very first tick after the hold', () => {
    const g = online();
    for (let t = 0; t < START_HOLD_TICKS; t++) step(g, [right, NO_COMMAND]);
    expect(g.players[0].x).toBe(0);
    step(g, [right, NO_COMMAND]);
    expect(g.players[0].x).toBe(PLAYER_SPEED);
    expect(g.timeLeft).toBe(599);
    step(g, [placeRight, NO_COMMAND]);
    expect(g.charges).toHaveLength(1);
  });

  it('holds bots too: a held round is the same whatever they press', () => {
    const g = online();
    const quiet = online();
    const bot = new Bot(1, 7, 'hard');
    for (let t = 0; t < START_HOLD_TICKS; t++) {
      step(g, [NO_COMMAND, bot.think(g)]);
      step(quiet, [NO_COMMAND, NO_COMMAND]);
    }
    expect(hashState(g)).toBe(hashState(quiet));
  });

  it('shifts the arena collapse by exactly the hold', () => {
    const g = online(60);
    let firstFall = -1;
    for (let t = 0; t < START_HOLD_TICKS + 60 + COLLAPSE_EVERY && firstFall < 0; t++) {
      step(g, [NO_COMMAND, NO_COMMAND]);
      if (g.events.some((e) => e.type === 'tile_collapsed')) firstFall = g.tick;
    }
    const plain = createGame(7, { mode: 'battle', players: 2, roundTicks: 60 });
    let plainFall = -1;
    for (let t = 0; t < 60 + COLLAPSE_EVERY && plainFall < 0; t++) {
      step(plain, [NO_COMMAND, NO_COMMAND]);
      if (plain.events.some((e) => e.type === 'tile_collapsed')) plainFall = plain.tick;
    }
    expect(plainFall).toBeGreaterThan(0);
    expect(firstFall).toBe(plainFall + START_HOLD_TICKS);
    expect(g.grid.cells[0]).toBe(Cell.Pillar);
  });

  it('starts level events after the hold too', () => {
    const rules = { ...NO_EVENTS, mazeShift: true };
    const held = createGame(7, { mode: 'battle', players: 2, roundTicks: 3600, rules, startHold: START_HOLD_TICKS });
    const plain = createGame(7, { mode: 'battle', players: 2, roundTicks: 3600, rules });
    const warnAt = (g: typeof held) => {
      for (let t = 0; t < 3600; t++) {
        step(g, [NO_COMMAND, NO_COMMAND]);
        if (g.events.some((e) => e.type === 'event_warning')) return g.tick;
      }
      return -1;
    };
    const plainWarn = warnAt(plain);
    expect(plainWarn).toBeGreaterThan(0);
    expect(warnAt(held)).toBe(plainWarn + START_HOLD_TICKS);
  });

  it('still lets a player leave during the count, which can end the round', () => {
    const g = online();
    step(g, [NO_COMMAND, { ...NO_COMMAND, leave: true }]);
    expect(g.players[1].alive).toBe(false);
    expect(g.status).toBe('round_over');
    expect(g.winner).toBe(0);
  });

  it('is part of the state hash', () => {
    expect(hashState(online())).not.toBe(hashState(createGame(7, { mode: 'battle', players: 2, roundTicks: 600 })));
  });
});
