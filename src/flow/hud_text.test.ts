import { describe, expect, it } from 'vitest';
import { BossKind } from '../sim/constants';
import { createGame } from '../sim/state';
import { clock, hudText, levelChip, type HudInfo } from './hud_text';

const info = (over: Partial<HudInfo> = {}): HudInfo => ({
  mode: 'survival', local: 0, level: 3, sector: 1, round: 1, score: [0, 0], ...over,
});

describe('hud text', () => {
  it('formats the clock', () => {
    expect(clock(60 * 65)).toBe('1:05');
    expect(clock(-5)).toBe('0:00');
  });

  it('story levels use the 1-3 chip, a short goal and no clock', () => {
    expect(levelChip(8, 2)).toBe('2-3');
    const t = hudText(createGame(1), info());
    expect(t.stage).toBe('1-3');
    expect(t.goal).toBe('Find the Gate');
    expect(t.clock).toBe('');
  });

  it('boss levels show the wave chip and the wave countdown clock', () => {
    const state = createGame(1, { boss: BossKind.GooplingHive });
    const t = hudText(state, info({ level: 5 }));
    expect(t.stage).toMatch(/^BOSS WAVE \d\/3$/);
    expect(t.stageClass).toBe('boss');
    expect(t.clock).toMatch(/^\d+:\d\d$/);
  });

  it('a finished boss is outlasted, never "defeated" (canon)', () => {
    const hive = createGame(1, { boss: BossKind.GooplingHive });
    hive.boss!.alive = false;
    expect(hudText(hive, info({ level: 5 })).goal).toBe('Hive ruptured!');
    const maze = createGame(1, { boss: BossKind.MazeMaster });
    maze.boss!.alive = false;
    expect(hudText(maze, info({ level: 15 })).goal).toBe('Maze Master survived!');
  });

  it('battle shows the round score and the round clock', () => {
    const state = createGame(1, { mode: 'battle' });
    const t = hudText(state, info({ mode: 'battle', round: 2, score: [1, 0] }));
    expect(t.stage).toBe('Round 2 · You 1–0 Bot');
    expect(t.clock).toMatch(/^\d+:\d\d$/);
  });

  it('the duel has no clock', () => {
    const t = hudText(createGame(1, { rival: true }), info({ level: 20, sector: 4 }));
    expect(t.stage).toBe('RIVAL DUEL');
    expect(t.goal).toBe('Stun Ducking');
    expect(t.clock).toBe('');
  });
});
