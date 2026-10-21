import { START_LIVES } from '../sim/constants';
import { LEVEL_COUNT, levelSpec } from '../sim/levels';

// Story Mode score and stars (Sonic-style end-of-level tally). Pure functions:
// no DOM, no state, so the room server can use the same numbers to reject
// impossible leaderboard scores. The score never feeds back into the game.

export const SCORE = {
  clear: 2000,
  martian: 500,
  /** Per second under par. */
  second: 20,
  heart: 1000,
} as const;

/** Par in seconds; bosses run on fixed wave timers, so they have none. */
export function parSeconds(level: number): number | null {
  const spec = levelSpec(level);
  if (spec.boss) return null;
  return spec.rival ? 60 : 75;
}

export interface LevelResult {
  level: number;
  martians: number;
  /** Ticks from the level start to the clear (60 per second). */
  ticks: number;
  /** 1..3 at a clear (losing all three is game over). */
  heartsLeft: number;
}

export interface ScoreBreakdown {
  clear: number;
  martians: number;
  time: number;
  hearts: number;
  total: number;
  seconds: number;
  stars: number;
}

export function scoreFor(r: LevelResult): ScoreBreakdown {
  const seconds = Math.floor(r.ticks / 60);
  const par = parSeconds(r.level);
  const hearts = Math.max(0, Math.min(START_LIVES, r.heartsLeft));
  const b = {
    clear: SCORE.clear,
    martians: Math.max(0, r.martians) * SCORE.martian,
    time: par === null ? 0 : Math.max(0, (par - seconds) * SCORE.second),
    hearts: hearts * SCORE.heart,
  };
  const total = b.clear + b.martians + b.time + b.hearts;
  return { ...b, total, seconds, stars: starsFor(r.level, total, hearts, seconds) };
}

/**
 * The score for 2 stars: a clear with 2 hearts left, half the Martians, and
 * (with a par) a quarter of the par time to spare.
 */
export function scoreTarget(level: number): number {
  const spec = levelSpec(level);
  const par = parSeconds(level);
  return SCORE.clear + 2 * SCORE.heart + Math.ceil(spec.roster.length / 2) * SCORE.martian + (par === null ? 0 : Math.round(par / 4) * SCORE.second);
}

/** 1: cleared. 2: score target met. 3: all hearts left and under par (bosses: all hearts). */
export function starsFor(level: number, total: number, heartsLeft: number, seconds: number): number {
  const par = parSeconds(level);
  if (heartsLeft >= START_LIVES && (par === null || seconds < par)) return 3;
  return total >= scoreTarget(level) ? 2 : 1;
}

/** Highest score the server accepts for a level (generous: hives keep spawning). */
export function maxScore(level: number): number {
  const spec = levelSpec(level);
  const par = parSeconds(level) ?? 0;
  const kills = spec.roster.length * 3 + (spec.boss ? 150 : 20);
  return SCORE.clear + START_LIVES * SCORE.heart + par * SCORE.second + kills * SCORE.martian;
}

/** Leaderboard id for a level: sector-level, e.g. level 8 = "stage_2_3". */
export function stageId(level: number): string {
  const spec = levelSpec(level);
  return `stage_${spec.sector}_${level - (spec.sector - 1) * 5}`;
}

/** The level for a stage id, or null if it isn't one. */
export function levelOfStage(id: string): number | null {
  const m = /^stage_([1-4])_([1-5])$/.exec(id);
  if (!m) return null;
  const level = (Number(m[1]) - 1) * 5 + Number(m[2]);
  return level >= 1 && level <= LEVEL_COUNT && stageId(level) === id ? level : null;
}
