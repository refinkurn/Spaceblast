import { describe, expect, it } from 'vitest';
import { START_HOLD_TICKS, TICK_RATE } from '../sim/constants';
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
  it('matches the online start hold the sim plays, tick for tick', () => {
    expect(START_HOLD_TICKS).toBe(Math.round(STEP_SECONDS * STEPS.length * TICK_RATE));
    // Online the count is read from the sim tick: BLAST! up to the last held tick, gone after it.
    expect(countdownLabel(0 / TICK_RATE)).toBe('3');
    expect(countdownLabel((START_HOLD_TICKS - 1) / TICK_RATE)).toBe('BLAST!');
    expect(countdownLabel(START_HOLD_TICKS / TICK_RATE)).toBeNull();
  });
});
