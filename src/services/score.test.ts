import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, levelSpec } from '../sim/levels';
import { levelOfStage, maxScore, parSeconds, scoreConsistent, scoreFor, scoreTarget, stageId, starsFor } from './score';
import { cleanName, defaultName, isRude } from './name_filter';

describe('story score', () => {
  it('adds clear, Martians, time under par and hearts', () => {
    // Level 1: par 75 s. 30 s used, 4 Martians, 3 hearts.
    const s = scoreFor({ level: 1, martians: 4, ticks: 30 * 60 + 59, heartsLeft: 3 });
    expect(s).toMatchObject({ clear: 2000, martians: 2000, time: 45 * 20, hearts: 3000, seconds: 30 });
    expect(s.total).toBe(2000 + 2000 + 900 + 3000);
    expect(s.stars).toBe(3);
  });

  it('gives no time bonus over par, and none on boss levels', () => {
    expect(scoreFor({ level: 1, martians: 0, ticks: 200 * 60, heartsLeft: 1 }).time).toBe(0);
    expect(parSeconds(5)).toBeNull();
    expect(scoreFor({ level: 5, martians: 10, ticks: 10 * 60, heartsLeft: 3 }).time).toBe(0);
    expect(parSeconds(20)).toBe(60);
  });

  it('stars: 1 for a clear, 2 for the target, 3 for all hearts under par', () => {
    const target = scoreTarget(3);
    expect(starsFor(3, target - 1, 2, 10)).toBe(1);
    expect(starsFor(3, target, 2, 10)).toBe(2);
    expect(starsFor(3, 0, 3, 10)).toBe(3);
    // All hearts but over par: back to the score target.
    expect(starsFor(3, target, 3, 80)).toBe(2);
    // Bosses have no par: all hearts is 3 stars.
    expect(starsFor(10, 0, 3, 500)).toBe(3);
  });

  it('caps what the server accepts above any real score', () => {
    for (let level = 1; level <= 20; level++) {
      const best = scoreFor({ level, martians: 20, ticks: 300, heartsLeft: 3 });
      expect(maxScore(level)).toBeGreaterThanOrEqual(best.total);
    }
  });

  it('names stages sector by sector and reads them back', () => {
    expect(stageId(1)).toBe('stage_1_1');
    expect(stageId(8)).toBe('stage_2_3');
    expect(stageId(20)).toBe('stage_4_5');
    for (let level = 1; level <= 20; level++) expect(levelOfStage(stageId(level))).toBe(level);
    expect(levelOfStage('stage_5_1')).toBeNull();
    expect(levelOfStage('stage_1_6')).toBeNull();
    expect(levelOfStage('level_1')).toBeNull();
  });
});

describe('leaderboard names', () => {
  it('keeps normal names and tidies spaces', () => {
    expect(cleanName('  Brave   Kit ')).toBe('Brave Kit');
    expect(cleanName('Bosco_482')).toBe('Bosco_482');
    expect(cleanName('Cassie')).toBe('Cassie');
    expect(cleanName('Cockpit Ace')).toBe('Cockpit Ace');
    expect(cleanName('Grape')).toBe('Grape');
    expect(cleanName('Bob')).toBe('Bob');
  });

  it('refuses rude, empty, too short or odd names', () => {
    for (const bad of ['fuck', 'FuUuCk1', 'sh1t head', 'kontol', 'b4ngsat', 'my ass', 'x', '', '<script>', 'a'.repeat(1)]) {
      expect(cleanName(bad)).toBeNull();
    }
    expect(isRude('ANJING')).toBe(true);
    expect(cleanName(42)).toBeNull();
  });

  it('makes friendly defaults', () => {
    expect(defaultName(() => 0)).toBe('Bosco_100');
    expect(cleanName(defaultName())).not.toBeNull();
  });
});

describe('server plausibility check', () => {
  it('accepts every genuine clear, exactly as the client sends it', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const most = levelSpec(level).roster.length + (levelSpec(level).boss ? 30 : 0);
      for (let martians = 0; martians <= most; martians += levelSpec(level).boss ? 5 : 1) {
        for (const heartsLeft of [1, 2, 3]) {
          for (const secs of [1, 4, 5, 6, 30, 59, 60, 74, 75, 76, 200, 900]) {
            const s = scoreFor({ level, martians, ticks: secs * 60 + 17, heartsLeft });
            // story_score.ts sends max(5, seconds) and the stars from the real time.
            expect(scoreConsistent(level, s.total, Math.max(5, s.seconds), heartsLeft, s.stars), `level ${level}, ${martians} M, ${heartsLeft} h, ${secs} s`).toBe(true);
          }
        }
      }
    }
  });

  it('rejects a score that is not reachable', () => {
    const s = scoreFor({ level: 3, martians: 2, ticks: 50 * 60, heartsLeft: 2 });
    expect(scoreConsistent(3, s.total + 100, 50, 2, s.stars)).toBe(false);
    expect(scoreConsistent(3, s.total, 50, 3, s.stars)).toBe(false);
    expect(scoreConsistent(3, s.total, 40, 2, s.stars)).toBe(false);
  });
});
