import { describe, expect, it } from 'vitest';
import { BossKind } from '../sim/constants';
import { createGame } from '../sim/state';
import { battleSummary, bossClearLine, fmtTime, storySummary } from './summary';

describe('end-of-match summary', () => {
  it('formats time as m:ss', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(60 * 83)).toBe('1:23');
  });

  it('story summary: time, lives lost, stars and Martians cleared', () => {
    const state = createGame(1);
    state.tick = 60 * 75;
    state.martians[0].alive = false;
    const rows = storySummary(state, 1, 2);
    expect(rows).toEqual([
      ['Time', '1:15'],
      ['Lives lost', '1'],
      ['Stars', '★★☆'],
      ['Martians cleared', `1 / ${state.martians.length}`],
    ]);
  });

  it('a lost level shows no stars', () => {
    expect(storySummary(createGame(1), 3, 0)[2]).toEqual(['Stars', '–']);
  });

  it('battle summary: round time and the score', () => {
    const state = createGame(1, { mode: 'battle' });
    state.tick = 60 * 61;
    expect(battleSummary(state, 'You 1 · Bot 0')).toEqual([['Round time', '1:01'], ['Score', 'You 1 · Bot 0']]);
  });

  it('boss clears never say destroyed', () => {
    for (const boss of [BossKind.GooplingHive, BossKind.DarknessHive, BossKind.MazeMaster]) {
      expect(bossClearLine(boss)).not.toMatch(/destroy/i);
    }
    expect(bossClearLine(BossKind.GooplingHive)).toBe('Hive ruptured!');
    expect(bossClearLine(BossKind.MazeMaster)).toBe('Maze Master survived!');
  });
});
