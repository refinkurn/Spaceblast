import { describe, expect, it } from 'vitest';
import { NO_COMMAND } from '../sim/command';
import { Dir, PLAYER_SPEED, START_HOLD_TICKS } from '../sim/constants';
import { hashState, step } from '../sim/sim';
import { createGame } from '../sim/state';
import { FrameSync } from './frames';
import { Predictor } from './predict';

const right = { dir: Dir.Right, alt: Dir.None, place: false };

/** Two players; the server's frames (both idle) have arrived for ticks 0 and 1. */
function setup() {
  const g = createGame(5, { mode: 'battle', players: 2 });
  const sync = new FrameSync(2);
  sync.receive(0, [[0, 0], [0, 0]], 1000);
  sync.setRtt(100); // aims presses 9 ticks past the newest frame
  return { g, sync };
}

describe('local prediction', () => {
  it('moves your astronaut on your own presses before the server confirms them', () => {
    const { g, sync } = setup();
    sync.input(right); // ticks 2..10
    const p = new Predictor().run(g, sync, 0)!;
    expect(p).not.toBeNull();
    expect(p.cur.x).toBe(9 * PLAYER_SPEED); // ticks 0-1 idle (confirmed), 2-10 walking right
    expect(p.prev.x).toBe(8 * PLAYER_SPEED);
  });

  it('never changes the confirmed game', () => {
    const { g, sync } = setup();
    sync.input({ ...right, place: true });
    const before = hashState(g);
    new Predictor().run(g, sync, 0);
    expect(hashState(g)).toBe(before);
    expect(g.players[0].x).toBe(0);
    expect(g.charges).toHaveLength(0);
  });

  it('shows your fresh charge at once', () => {
    const { g, sync } = setup();
    sync.input({ dir: Dir.None, alt: Dir.None, place: true });
    const p = new Predictor().run(g, sync, 0)!;
    expect(p.charges).toMatchObject([{ owner: 0, tx: 0, ty: 0 }]);
  });

  it('predicts no movement during the online start hold, and moves right after it', () => {
    const g = createGame(5, { mode: 'battle', players: 2, startHold: START_HOLD_TICKS });
    const sync = new FrameSync(2);
    sync.receive(0, [[0, 0], [0, 0]], 1000);
    sync.setRtt(100);
    sync.input(right); // ticks 2..10, all inside the hold
    expect(new Predictor().run(g, sync, 0)).toBeNull();

    // Confirmed game 4 ticks before the hold ends, presses aimed 12 ticks ahead:
    // the first 4 predicted ticks are held, the other 8 walk.
    const late = createGame(5, { mode: 'battle', players: 2, startHold: START_HOLD_TICKS });
    const idle = Array.from({ length: START_HOLD_TICKS - 4 }, () => [0, 0]);
    for (let t = 0; t < idle.length; t++) step(late, [NO_COMMAND, NO_COMMAND]);
    const s2 = new FrameSync(2);
    s2.receive(0, idle, 1000);
    for (let t = 0; t < idle.length; t++) s2.next();
    s2.setRtt(150);
    s2.input(right);
    const p = new Predictor().run(late, s2, 0)!;
    expect(p).not.toBeNull();
    expect(late.players[0].x).toBe(0);
    expect(p.cur.x).toBe(8 * PLAYER_SPEED);
  });

  it('predicts nothing for a knocked-out astronaut', () => {
    const { g, sync } = setup();
    sync.input(right);
    g.players[0].alive = false;
    expect(new Predictor().run(g, sync, 0)).toBeNull();
  });
});
