import { describe, expect, it } from 'vitest';
import { Bot } from '../input/bot';
import { hashState, step } from '../sim/sim';
import { createGame } from '../sim/state';
import { Recorder } from './cinematic';

describe('round replay recorder', () => {
  it('rebuilds the exact state of any recent tick, so the replay shows what really happened', () => {
    const g = createGame(42, { mode: 'battle', players: 3 });
    const bots = [0, 1, 2].map((id) => new Bot(id, 42, 'hard'));
    const rec = new Recorder();
    const hashes = new Map<number, number>();
    while (g.status === 'playing' && g.tick < 900) {
      const cmds = bots.map((b) => b.think(g));
      rec.before(g, cmds);
      step(g, cmds);
      rec.after(g);
      hashes.set(g.tick, hashState(g));
    }
    const back = g.tick - 75;
    const again = rec.stateAt(back);
    expect(again).not.toBeNull();
    expect(hashState(again!)).toBe(hashes.get(back));
    // Older than the recording window: not available.
    if (g.tick > 400) expect(rec.stateAt(g.tick - 400)).toBeNull();
  });

  it('remembers the last knock-out', () => {
    const g = createGame(3, { mode: 'battle', roundTicks: 10 });
    const rec = new Recorder();
    const idle = [{ dir: 0, alt: 0, place: false }, { dir: 0, alt: 0, place: false }] as const;
    while (g.status === 'playing') {
      rec.before(g, [...idle]);
      step(g, idle);
      rec.after(g);
    }
    expect(rec.lastDeath?.tick).toBe(g.tick); // the collapse crushed player 0 on the final tick
    expect(rec.lastDeath?.x).toBe(0);
  });
});
