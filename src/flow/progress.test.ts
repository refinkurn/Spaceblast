import { describe, expect, it } from 'vitest';
import { StoryProgress, starsFor } from './progress';

describe('story progress', () => {
  it('gives 1 star for a clear, +1 for no lives lost, +1 for a quick clear', () => {
    expect(starsFor(1, 0, 60 * 60)).toBe(3);
    expect(starsFor(1, 1, 60 * 60)).toBe(2);
    expect(starsFor(1, 0, 120 * 60)).toBe(2);
    expect(starsFor(1, 2, 120 * 60)).toBe(1);
    // Boss levels can't be rushed: time doesn't count there.
    expect(starsFor(5, 0, 200 * 60)).toBe(3);
  });

  it('unlocks the next level, keeps the best stars, and finishes after level 20', () => {
    const p = new StoryProgress();
    expect(p.unlocked).toBe(1);
    expect(p.started).toBe(false);
    p.clear(1, 2);
    p.clear(1, 1);
    expect(p.stars(1)).toBe(2);
    expect(p.unlocked).toBe(2);
    p.clear(7, 3);
    expect(p.unlocked).toBe(8);
    p.clear(3, 3); // replaying an earlier level doesn't lock anything
    expect(p.unlocked).toBe(8);
    expect(p.totalStars).toBe(8);
    p.clear(20, 1);
    expect(p.finished).toBe(true);
    expect(p.unlocked).toBe(20);
  });
});
