import { describe, expect, it } from 'vitest';
import { Dir, PLAYER_SPEED } from '../sim/constants';
import { hashState } from '../sim/sim';
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

  it('predicts nothing for a knocked-out astronaut', () => {
    const { g, sync } = setup();
    sync.input(right);
    g.players[0].alive = false;
    expect(new Predictor().run(g, sync, 0)).toBeNull();
  });
});
