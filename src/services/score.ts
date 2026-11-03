import { arenaPillar } from '../sim/arenas';
import { GRID_H, GRID_W, START_LIVES, STAGE_PAR_SECONDS } from '../sim/constants';
import { inSpawnZone } from '../sim/grid';
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
  /** Per gem (Star Dot) picked up. Optional: score targets don't count gems. */
  gem: 50,
} as const;

/**
 * Par in seconds (levels.ts): stages 1-4 of a sector 90/80/75/60, the duel 60;
 * bosses run on fixed wave timers, so they have none.
 */
export function parSeconds(level: number): number | null {
  return levelSpec(level).par;
}

/** Par every normal level had before the per-stage pars: rows queued offline before the update still validate. */
const LEGACY_PAR = 75;

/** Most gems a level can hold: one per floor tile that can start as a rock (density 100 %). */
export function maxGems(level: number): number {
  const arena = levelSpec(level).arena;
  let n = 0;
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (!arenaPillar(arena, x, y) && !inSpawnZone(x, y)) n++;
  return n;
}

export interface LevelResult {
  level: number;
  martians: number;
  /** Ticks from the level start to the clear (60 per second). */
  ticks: number;
  /** 1..3 at a clear (losing all three is game over). */
  heartsLeft: number;
  /** Gems picked up (sim gemsCollected); 0 if left out. */
  gems?: number;
}

export interface ScoreBreakdown {
  clear: number;
  martians: number;
  time: number;
  hearts: number;
  gems: number;
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
    gems: Math.max(0, Math.min(maxGems(r.level), r.gems ?? 0)) * SCORE.gem,
  };
  const total = b.clear + b.martians + b.time + b.hearts + b.gems;
  return { ...b, total, seconds, stars: starsFor(r.level, total, hearts, seconds) };
}

/**
 * The score for 2 stars: a clear with 2 hearts left, half the Martians, and
 * (with a par) a quarter of the par time to spare. Gems are a bonus on top.
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

/** Pars a submitted row may have been scored with: today's, and (normal levels) the old 75 s. */
function parsAccepted(level: number): (number | null)[] {
  const par = parSeconds(level);
  const spec = levelSpec(level);
  return par !== null && spec.stage <= STAGE_PAR_SECONDS.length && par !== LEGACY_PAR ? [par, LEGACY_PAR] : [par];
}

/** Highest score the server accepts for a level (generous: hives keep spawning). */
export function maxScore(level: number): number {
  const spec = levelSpec(level);
  const par = Math.max(0, ...parsAccepted(level).map((p) => p ?? 0));
  const kills = spec.roster.length * 3 + (spec.boss ? 150 : 20);
  return SCORE.clear + START_LIVES * SCORE.heart + par * SCORE.second + kills * SCORE.martian + maxGems(level) * SCORE.gem;
}

/**
 * Could a real clear produce this row? The score must be clear + hearts + the
 * time bonus for these seconds + `gems` gems + a whole number of Martians
 * (within the maxScore allowance), and the stars must be what starsFor gives.
 * The client reports at least 5 s, so a reported 5 also allows the bonus of a
 * faster clear. 1 vs 2 stars only depends on the score target, which moves when
 * a level's roster is retuned, so a row queued offline before an update may
 * carry either; such a row may also be timed against the old 75 s par and has
 * no gems (a missing gems field is 0).
 */
export function scoreConsistent(level: number, total: number, seconds: number, heartsLeft: number, stars: number, gems = 0): boolean {
  const spec = levelSpec(level);
  if (!Number.isInteger(gems) || gems < 0 || gems > maxGems(level)) return false;
  const maxKills = spec.roster.length * 3 + (spec.boss ? 150 : 20);
  const fastest = seconds === 5 ? 0 : seconds;
  for (const par of parsAccepted(level)) {
    for (let s = seconds; s >= fastest; s--) {
      const time = par === null ? 0 : Math.max(0, (par - s) * SCORE.second);
      const kills = (total - SCORE.clear - heartsLeft * SCORE.heart - time - gems * SCORE.gem) / SCORE.martian;
      if (!Number.isInteger(kills) || kills < 0 || kills > maxKills) continue;
      // Stars as the game gives them today, or (old par) as an older client did: 3 = all hearts under that par.
      const legacy = par !== parSeconds(level);
      const expected = !legacy ? starsFor(level, total, heartsLeft, s) : heartsLeft >= START_LIVES && s < par! ? 3 : 1;
      if (starsMatch(stars, expected)) return true;
    }
  }
  return false;
}

function starsMatch(sent: number, expected: number): boolean {
  return sent === expected || (sent < 3 && expected < 3);
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
