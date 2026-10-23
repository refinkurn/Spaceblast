import { describe, expect, it } from 'vitest';
import { bossWaveCount } from '../sim/boss';
import { BossKind } from '../sim/constants';
import { createGame } from '../sim/state';
import { COUNTDOWN_SECONDS, bossSecondsLeft } from './boss_countdown';

describe('boss final countdown', () => {
  it('shows only in the last 15 s of the final wave', () => {
    const s = createGame(5, { boss: BossKind.GooplingHive });
    const b = s.boss!;
    expect(b).toBeTruthy();
    b.wave = bossWaveCount(b);
    b.timer = COUNTDOWN_SECONDS * 60;
    expect(bossSecondsLeft(s)).toBe(15);
    b.timer = 4 * 60 + 1;
    expect(bossSecondsLeft(s)).toBe(5);
    b.timer = COUNTDOWN_SECONDS * 60 + 1;
    expect(bossSecondsLeft(s)).toBeNull();
    b.timer = 300;
    b.wave = 1;
    expect(bossSecondsLeft(s)).toBeNull();
  });

  it('is off on normal levels', () => {
    expect(bossSecondsLeft(createGame(3))).toBeNull();
  });
});
