import { describe, expect, it } from 'vitest';
import { BossKind } from '../sim/constants';
import { createGame } from '../sim/state';
import { battleSummary, bossClearLine, fmtTime, storySummary } from './summary';
import { MatchTally } from './match_tally';

describe('end-of-match summary', () => {
  it('formats time as m:ss', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(60 * 83)).toBe('1:23');
  });

  it('story clear: stars, time, hearts left, then what you did on the map', () => {
    const state = createGame(1);
    state.tick = 60 * 75;
    const m = new MatchTally();
    m.track(state, [
      { type: 'rock_broken', tx: 1, ty: 1 }, { type: 'rock_broken', tx: 2, ty: 1 },
      { type: 'martian_killed', id: 7, tx: 3, ty: 3 },
      { type: 'item_picked', id: 0, item: 1, tx: 1, ty: 1 }, { type: 'item_picked', id: 1, item: 1, tx: 5, ty: 5 },
    ], 0);
    expect(storySummary(state, m, 1, 2)).toEqual([
      ['Stars', '★★☆'],
      ['Time', '1:15'],
      ['Hearts left', '2 / 3'],
      ['Martians defeated', '1'],
      ['Rocks destroyed', '2'],
      ['Power-ups', '1'],
    ]);
  });

  it('a lost level shows no stars or hearts', () => {
    const rows = storySummary(createGame(1), new MatchTally(), 3, 0);
    expect(rows.map((r) => r[0])).toEqual(['Time', 'Martians defeated', 'Rocks destroyed', 'Power-ups']);
  });

  it('starts over on a new game', () => {
    const m = new MatchTally();
    m.track(createGame(1), [{ type: 'rock_broken', tx: 1, ty: 1 }], 0);
    m.track(createGame(1), [], 0);
    expect(m.rocks).toBe(0);
  });

  it('battle summary: score, round time, rocks and power-ups', () => {
    const state = createGame(1, { mode: 'battle' });
    state.tick = 60 * 61;
    expect(battleSummary(state, new MatchTally(), 'You 1 · Bot 0')).toEqual([['Score', 'You 1 · Bot 0'], ['Round time', '1:01'], ['Rocks destroyed', '0'], ['Power-ups', '0']]);
  });

  it('boss clears never say destroyed', () => {
    for (const boss of [BossKind.GooplingHive, BossKind.DarknessHive, BossKind.MazeMaster]) {
      expect(bossClearLine(boss)).not.toMatch(/destroy/i);
    }
    expect(bossClearLine(BossKind.GooplingHive)).toBe('Hive ruptured!');
    expect(bossClearLine(BossKind.MazeMaster)).toBe('Maze Master survived!');
  });
});
