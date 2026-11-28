import { describe, expect, it } from 'vitest';
import { START_LIVES } from './constants';
import { storyOptions } from './levels';
import { hashState } from './sim';
import { createGame } from './state';

describe('rewarded extra heart (bonusLives)', () => {
  it('gives the Story player one extra heart, never more', () => {
    expect(createGame(5, storyOptions(3)).players[0].lives).toBe(START_LIVES);
    expect(createGame(5, { ...storyOptions(3), bonusLives: 1 }).players[0].lives).toBe(START_LIVES + 1);
    expect(createGame(5, { ...storyOptions(3), bonusLives: 9 }).players[0].lives).toBe(START_LIVES + 1);
    expect(createGame(5, { ...storyOptions(3), bonusLives: -2 }).players[0].lives).toBe(START_LIVES);
  });

  it('is part of the game state hash', () => {
    expect(hashState(createGame(5, { ...storyOptions(3), bonusLives: 1 }))).not.toBe(hashState(createGame(5, storyOptions(3))));
  });

  it('never applies to battle or to the duel rival', () => {
    expect(createGame(5, { mode: 'battle', bonusLives: 1 }).players.map((p) => p.lives)).toEqual([1, 1]);
    const duel = createGame(5, { ...storyOptions(20), bonusLives: 1 });
    expect(duel.players[0].lives).toBe(START_LIVES + 1);
    expect(duel.players[1].lives).toBe(1);
  });
});
