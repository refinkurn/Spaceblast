import { describe, expect, it } from 'vitest';
import { wantsQuickStart } from './portal';

describe('quick start', () => {
  it('is for a fresh save on a build that has it on', () => {
    expect(wantsQuickStart(true, true, '')).toBe(true);
    expect(wantsQuickStart(false, true, '')).toBe(false);
  });

  it('never repeats on a save that has played before', () => {
    expect(wantsQuickStart(true, false, '')).toBe(false);
  });

  it('gives way to a room invite', () => {
    expect(wantsQuickStart(true, true, '?room=ABCD')).toBe(false);
    expect(wantsQuickStart(true, true, '?quickstart')).toBe(true);
  });
});
