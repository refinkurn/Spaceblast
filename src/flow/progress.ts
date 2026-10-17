import { LEVEL_COUNT, levelSpec } from '../sim/levels';

// Story Mode progress, saved on this device: the furthest level reached, the
// best stars per level, and run totals for the ending screen.

const KEY = 'spaceblast.story';

export interface StoryStats {
  martians: number;
  bosses: number;
  livesLost: number;
  /** Ticks played in Story Mode (60 per second). */
  ticks: number;
}

interface Saved {
  /** Highest level you can play (the one after your furthest clear). */
  unlocked: number;
  stars: Record<number, number>;
  stats: StoryStats;
  finished: boolean;
}

const fresh = (): Saved => ({ unlocked: 1, stars: {}, stats: { martians: 0, bosses: 0, livesLost: 0, ticks: 0 }, finished: false });

/**
 * Stars for a cleared level: 1 for clearing it, +1 for losing no lives,
 * +1 for being quick (bosses can't be rushed, so there it's free).
 */
export function starsFor(level: number, livesLost: number, ticks: number): number {
  const spec = levelSpec(level);
  const par = spec.boss ? Infinity : spec.rival ? 60 * 60 : 75 * 60;
  return 1 + (livesLost === 0 ? 1 : 0) + (ticks <= par ? 1 : 0);
}

export class StoryProgress {
  private data: Saved = fresh();

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...fresh(), ...JSON.parse(raw) };
    } catch { /* private mode: progress lasts for this visit only */ }
  }

  get unlocked(): number {
    return Math.min(LEVEL_COUNT, Math.max(1, this.data.unlocked));
  }

  get started(): boolean {
    return this.data.unlocked > 1 || Object.keys(this.data.stars).length > 0;
  }

  get finished(): boolean {
    return this.data.finished;
  }

  get stats(): StoryStats {
    return this.data.stats;
  }

  stars(level: number): number {
    return this.data.stars[level] ?? 0;
  }

  get totalStars(): number {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }

  /** Records a clear; keeps the best stars and unlocks the next level. */
  clear(level: number, stars: number): void {
    this.data.stars[level] = Math.max(this.stars(level), stars);
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVEL_COUNT, level + 1));
    if (level >= LEVEL_COUNT) this.data.finished = true;
    this.save();
  }

  /** Adds to the run totals (saved with the next clear or game over). */
  add(change: Partial<StoryStats>): void {
    const s = this.data.stats;
    s.martians += change.martians ?? 0;
    s.bosses += change.bosses ?? 0;
    s.livesLost += change.livesLost ?? 0;
    s.ticks += change.ticks ?? 0;
  }

  save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode */ }
  }
}
