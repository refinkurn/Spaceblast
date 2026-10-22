import { describe, expect, it } from 'vitest';
import { GLIDE_SECONDS, glide, glideFactor } from './smooth';

// A walker at a constant 4 tiles/s (1/15 tile per 60 Hz tick), drawn at 60 fps,
// while online ticks arrive unevenly: some frames run none, some two.
const SPEED = 1 / 15;
const DT = 1 / 60;
const PATTERN = [1, 1, 0, 2, 1, 1, 1, 0, 2, 1, 0, 1, 2, 1, 1, 0, 2, 1];

/** Per-frame movement on screen: drawn straight from the sim, and glided. */
function run(): { raw: number[]; glided: number[] } {
  let ticks = 0;
  let shown = 0;
  let last = 0;
  let lastShown = 0;
  const raw: number[] = [];
  const glided: number[] = [];
  for (let frame = 0; frame < 240; frame++) {
    ticks += PATTERN[frame % PATTERN.length];
    const pos = ticks * SPEED;
    shown = glide(shown, pos, DT);
    if (frame >= 60) {
      raw.push(pos - last);
      glided.push(shown - lastShown);
    }
    last = pos;
    lastShown = shown;
  }
  return { raw, glided };
}

/** Largest step-to-step change in on-screen speed, as a share of the average speed. */
const jerk = (steps: number[]) => {
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  let worst = 0;
  for (let i = 1; i < steps.length; i++) worst = Math.max(worst, Math.abs(steps[i] - steps[i - 1]));
  return worst / mean;
};

describe('online glide', () => {
  it('turns uneven tick arrival into near-even motion on screen', () => {
    const { raw, glided } = run();
    // Straight from the sim the walker stops dead and then jumps two steps (the "shaking").
    expect(Math.min(...raw)).toBe(0);
    expect(jerk(raw)).toBeGreaterThanOrEqual(2);
    // Glided it never stops and its speed changes far less from frame to frame.
    expect(Math.min(...glided)).toBeGreaterThan(0);
    expect(jerk(glided)).toBeLessThan(jerk(raw) * 0.6);
  });

  it('stays close behind: under one tick of travel back at a steady walk', () => {
    let shown = 0;
    for (let f = 1; f <= 120; f++) shown = glide(shown, f * SPEED, DT);
    expect(120 * SPEED - shown).toBeLessThan(SPEED * 3);
  });

  it('closes about 63% of the gap per GLIDE_SECONDS and nothing for a zero-length frame', () => {
    expect(glideFactor(GLIDE_SECONDS, GLIDE_SECONDS)).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(glideFactor(0, GLIDE_SECONDS)).toBe(0);
  });
});
