import { describe, expect, it } from 'vitest';
import { scenarioOf, scenarioFlags } from './online_options';
import { stepIndex } from './stepper';

describe('‹ value › selector', () => {
  it('steps forward and back and wraps around', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(1, -1, 3)).toBe(0);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe('lobby scenarios as one choice', () => {
  it('maps the two scenario switches to Off / Maze Shift / Blackout / Both and back', () => {
    for (const maze of [false, true]) {
      for (const blackout of [false, true]) {
        expect(scenarioFlags(scenarioOf({ maze, blackout }))).toEqual({ maze, blackout });
      }
    }
    expect(scenarioOf({ maze: false, blackout: false })).toBe('off');
    expect(scenarioOf({ maze: true, blackout: true })).toBe('both');
  });
});
