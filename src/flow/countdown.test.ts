import { describe, expect, it } from 'vitest';
import { countdownLabel, STEP_SECONDS, STEPS } from './countdown';

describe('countdown', () => {
  it('shows 3, 2, 1, BLAST! then ends', () => {
    expect(countdownLabel(0)).toBe('3');
    expect(countdownLabel(STEP_SECONDS * 1.5)).toBe('2');
    expect(countdownLabel(STEP_SECONDS * 2.5)).toBe('1');
    expect(countdownLabel(STEP_SECONDS * 3.5)).toBe('BLAST!');
    expect(countdownLabel(STEP_SECONDS * STEPS.length)).toBeNull();
  });
  it('lasts about 2.4 s in total', () => {
    expect(STEP_SECONDS * STEPS.length).toBeCloseTo(2.4);
  });
});
