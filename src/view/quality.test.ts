import { describe, expect, it } from 'vitest';
import { AdaptiveQuality } from './quality';

describe('adaptive render quality', () => {
  const run = (q: AdaptiveQuality, ms: number, frames: number) => {
    let changed: number | null = null;
    for (let i = 0; i < frames; i++) changed = q.frame(ms) ?? changed;
    return changed;
  };

  it('starts at the device ratio, capped at 2', () => {
    expect(new AdaptiveQuality(3).pixelRatio).toBe(2);
    expect(new AdaptiveQuality(2).pixelRatio).toBe(2);
    expect(new AdaptiveQuality(1).pixelRatio).toBe(1);
  });

  it('steps down after about 2 s of slow frames, never below 1, and never back up', () => {
    const q = new AdaptiveQuality(3);
    expect(run(q, 16, 400)).toBeNull(); // 60 fps: fine
    expect(run(q, 30, 120)).toBe(1.5);
    expect(run(q, 30, 120)).toBe(1);
    expect(run(q, 30, 500)).toBeNull();
    expect(run(q, 8, 500)).toBeNull();
    expect(q.pixelRatio).toBe(1);
  });

  it('ignores pauses (a hidden tab)', () => {
    const q = new AdaptiveQuality(2);
    expect(run(q, 5000, 300)).toBeNull();
    expect(q.pixelRatio).toBe(2);
  });
});
