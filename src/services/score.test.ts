import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, levelSpec } from '../sim/levels';
import { levelOfStage, maxGems, maxScore, parSeconds, SCORE, scoreConsistent, scoreFor, scoreTarget, stageId, starsFor } from './score';
import { cleanName, defaultName, isRude } from './name_filter';

describe('story score', () => {
  it('adds clear, Martians, time under par and hearts', () => {
    // Level 1: par 90 s. 30 s used, 4 Martians, 3 hearts.
    const s = scoreFor({ level: 1, martians: 4, ticks: 30 * 60 + 59, heartsLeft: 3 });
    expect(s).toMatchObject({ clear: 2000, martians: 2000, time: 60 * 20, hearts: 3000, gems: 0, seconds: 30 });
    expect(s.total).toBe(2000 + 2000 + 1200 + 3000);
    expect(s.stars).toBe(3);
  });

  it('adds 50 per gem, capped at what the level can hold; gems never raise the score target', () => {
    expect(SCORE.gem).toBe(50);
    const base = scoreFor({ level: 2, martians: 1, ticks: 40 * 60, heartsLeft: 2 });
    const withGems = scoreFor({ level: 2, martians: 1, ticks: 40 * 60, heartsLeft: 2, gems: 12 });
    expect(withGems.gems).toBe(600);
    expect(withGems.total).toBe(base.total + 600);
    expect(scoreFor({ level: 2, martians: 0, ticks: 600, heartsLeft: 1, gems: 10_000 }).gems).toBe(maxGems(2) * 50);
    // Level 1 on the dunes layout: 143 tiles - 24 pillars - 4 x 9 spawn tiles (4 of them pillars) = 87 tiles a rock can start on.
    expect(maxGems(1)).toBe(87);
    // The 2-star target is the same with or without gems (gems are a bonus: they can only help).
    const target = scoreTarget(2);
    expect(target).toBe(2000 + 2000 + 2 * 500 + Math.round(80 / 4) * 20);
    expect(starsFor(2, target - 50, 2, 40)).toBe(1);
    expect(starsFor(2, target - 50 + 50, 2, 40)).toBe(2);
  });

  it('par per stage: 90/80/75/60 s in every sector, none on bosses, 60 on the duel', () => {
    const pars = Array.from({ length: LEVEL_COUNT }, (_, i) => parSeconds(i + 1));
    expect(pars).toEqual([90, 80, 75, 60, null, 90, 80, 75, 60, null, 90, 80, 75, 60, null, 90, 80, 75, 60, 60]);
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
      const best = scoreFor({ level, martians: 20, ticks: 300, heartsLeft: 3, gems: maxGems(level) });
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
          for (const secs of [1, 4, 5, 6, 30, 59, 60, 74, 75, 76, 79, 80, 89, 90, 91, 200, 900]) {
            for (const gems of [0, 7, maxGems(level)]) {
              const s = scoreFor({ level, martians, ticks: secs * 60 + 17, heartsLeft, gems });
              // story_score.ts sends max(5, seconds) and the stars from the real time.
              expect(scoreConsistent(level, s.total, Math.max(5, s.seconds), heartsLeft, s.stars, gems), `level ${level}, ${martians} M, ${heartsLeft} h, ${secs} s, ${gems} gems`).toBe(true);
            }
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

  it('accepts 1 or 2 stars from a row queued before a score-target change, never a wrong 3', () => {
    const s = scoreFor({ level: 3, martians: 2, ticks: 50 * 60, heartsLeft: 2 });
    expect(scoreConsistent(3, s.total, 50, 2, 3 - s.stars)).toBe(true);
    expect(scoreConsistent(3, s.total, 50, 2, 3)).toBe(false);
    const best = scoreFor({ level: 3, martians: 2, ticks: 40 * 60, heartsLeft: 3 });
    expect(scoreConsistent(3, best.total, 40, 3, 2)).toBe(false);
  });

  it('checks the gem count: whole, not negative, not more than the level holds', () => {
    const s = scoreFor({ level: 3, martians: 2, ticks: 50 * 60, heartsLeft: 2, gems: 5 });
    expect(scoreConsistent(3, s.total, 50, 2, s.stars, 5)).toBe(true);
    expect(scoreConsistent(3, s.total, 50, 2, s.stars, 6)).toBe(false); // gems don't add up
    expect(scoreConsistent(3, s.total, 50, 2, s.stars, -1)).toBe(false);
    expect(scoreConsistent(3, s.total, 50, 2, s.stars, 1.5)).toBe(false);
    expect(scoreConsistent(3, s.total + 50 * (maxGems(3) + 1 - 5), 50, 2, s.stars, maxGems(3) + 1)).toBe(false);
  });

  it('still accepts a row an older client scored with the old 75 s par and no gems', () => {
    // Level 1 before the per-stage pars: 2,000 + 3,000 hearts + (75 - 60) x 20 + 3 x 500 = 6,800, 3 stars.
    expect(scoreConsistent(1, 6800, 60, 3, 3)).toBe(true);
    expect(scoreConsistent(1, 6800, 60, 3, 2)).toBe(false); // all hearts under the old par was 3 stars
    // Level 4 (par now 60): an old row 70 s with all hearts got 3 stars under par 75.
    const old = 2000 + 3000 + 5 * 20 + 4 * 500;
    expect(scoreConsistent(4, old, 70, 3, 3)).toBe(true);
    expect(maxScore(4)).toBeGreaterThanOrEqual(old);
  });
});
