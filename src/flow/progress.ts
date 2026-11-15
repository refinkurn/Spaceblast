import { LEVEL_COUNT } from '../sim/levels';
import { writeAccountData } from '../services/crazygames';

// Story Mode progress, saved on this device: the furthest level reached, the
// best stars per level, run totals for the ending screen, and which tutorial
// steps and enemy / power-up cards have been shown (once per save).

export const KEY = 'spaceblast.story';
const OLD_BEATS_KEY = 'spaceblast.tutorial';

export interface StoryStats {
  martians: number;
  bosses: number;
  livesLost: number;
  /** Ticks played in Story Mode (60 per second). */
  ticks: number;
}

export interface Saved {
  /** Highest level you can play (the one after your furthest clear). */
  unlocked: number;
  stars: Record<number, number>;
  /** Best score per level (services/score.ts). */
  scores: Record<number, number>;
  stats: StoryStats;
  finished: boolean;
  /** Captain Kit's opening card (story_scenes.ts OPENING_TUTORIAL) was shown. */
  tutorialSeen: boolean;
  /** Quick start (config/portal.ts): level 1 was played first, so the opening crawl and prologue are still to come. */
  introPending: boolean;
  /** Ids of the tutorial steps already shown (tutorial_script.ts). */
  seenBeats: string[];
  /** Ids of the enemy cards already shown (alien_cards.ts). */
  seenEnemies: string[];
  /** Ids of the power-up cards already shown (powerup_cards.ts). */
  seenPowerups: string[];
}

export type CardList = 'seenBeats' | 'seenEnemies' | 'seenPowerups';

const fresh = (): Saved => ({
  unlocked: 1, stars: {}, scores: {}, stats: { martians: 0, bosses: 0, livesLost: 0, ticks: 0 }, finished: false, tutorialSeen: false, introPending: false, seenBeats: [], seenEnemies: [], seenPowerups: [],
});

/** A saved list of card ids: short lowercase words only, no repeats. */
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && /^[a-z_]{1,24}$/.test(x)))].slice(0, 32) : [];

/** Saved data checked field by field, so old or edited data can't break the game. */
export function sanitize(raw: Partial<Saved> | null): Saved {
  const out = fresh();
  if (!raw || typeof raw !== 'object') return out;
  const int = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, max) : 0);
  out.unlocked = Math.max(1, int(raw.unlocked, LEVEL_COUNT));
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const s = int(raw.stars?.[n], 3);
    if (s > 0) out.stars[n] = s;
    const best = int(raw.scores?.[n], 1e7);
    if (best > 0) out.scores[n] = best;
  }
  const st = raw.stats;
  out.stats = { martians: int(st?.martians, 1e9), bosses: int(st?.bosses, 1e9), livesLost: int(st?.livesLost, 1e9), ticks: int(st?.ticks, 1e12) };
  out.finished = raw.finished === true;
  out.tutorialSeen = raw.tutorialSeen === true;
  out.introPending = raw.introPending === true;
  // Older saves used seenAliens / seenPowerUps.
  const old = raw as { seenAliens?: unknown; seenPowerUps?: unknown };
  out.seenBeats = ids(raw.seenBeats);
  out.seenEnemies = ids(raw.seenEnemies ?? old.seenAliens);
  out.seenPowerups = ids(raw.seenPowerups ?? old.seenPowerUps);
  return out;
}

const best = (a: Record<number, number>, b: Record<number, number>): Record<number, number> => {
  const out: Record<number, number> = {};
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const v = Math.max(a[n] ?? 0, b[n] ?? 0);
    if (v > 0) out[n] = v;
  }
  return out;
};

/** Two saves of the same player (this device and the CrazyGames account) as one: the best of each field. */
export function mergeSaved(a: Saved, b: Saved): Saved {
  return {
    unlocked: Math.max(a.unlocked, b.unlocked),
    stars: best(a.stars, b.stars),
    scores: best(a.scores, b.scores),
    stats: {
      martians: Math.max(a.stats.martians, b.stats.martians),
      bosses: Math.max(a.stats.bosses, b.stats.bosses),
      livesLost: Math.max(a.stats.livesLost, b.stats.livesLost),
      ticks: Math.max(a.stats.ticks, b.stats.ticks),
    },
    finished: a.finished || b.finished,
    tutorialSeen: a.tutorialSeen || b.tutorialSeen,
    // The opening story is still owed only if neither copy has had it.
    introPending: a.introPending && b.introPending,
    seenBeats: ids([...a.seenBeats, ...b.seenBeats]),
    seenEnemies: ids([...a.seenEnemies, ...b.seenEnemies]),
    seenPowerups: ids([...a.seenPowerups, ...b.seenPowerups]),
  };
}

export class StoryProgress {
  private data: Saved = fresh();

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = sanitize(JSON.parse(raw));
      // Tutorial steps used to be saved on their own.
      const beats = localStorage.getItem(OLD_BEATS_KEY);
      if (beats) {
        this.data.seenBeats = ids([...this.data.seenBeats, ...(JSON.parse(beats) as unknown[])]);
        localStorage.removeItem(OLD_BEATS_KEY);
        this.save();
      }
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

  bestScore(level: number): number {
    return this.data.scores[level] ?? 0;
  }

  get totalStars(): number {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }

  /** Records a clear; keeps the best stars and score, and unlocks the next level. */
  clear(level: number, stars: number, score = 0): void {
    this.data.stars[level] = Math.max(this.stars(level), stars);
    if (score > this.bestScore(level)) this.data.scores[level] = score;
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVEL_COUNT, level + 1));
    if (level >= LEVEL_COUNT) this.data.finished = true;
    this.save();
  }

  get tutorialSeen(): boolean {
    return this.data.tutorialSeen;
  }

  markTutorialSeen(): void {
    this.data.tutorialSeen = true;
    this.save();
  }

  get introPending(): boolean {
    return this.data.introPending;
  }

  setIntroPending(pending: boolean): void {
    this.data.introPending = pending;
    this.save();
  }

  /** Settings, "show the tutorial again": the opening card, every tutorial step and every card. */
  resetTutorial(): void {
    this.data.tutorialSeen = false;
    this.data.seenBeats = [];
    this.data.seenEnemies = [];
    this.data.seenPowerups = [];
    this.save();
  }

  /** Has this alien or power-up card been shown on this save? */
  seen(list: CardList, id: string): boolean {
    return this.data[list].includes(id);
  }

  /** Marks a card as shown (saved straight away: it never shows again). */
  markSeen(list: CardList, id: string): void {
    if (this.seen(list, id)) return;
    this.data[list].push(id);
    this.save();
  }

  /** The tutorial's record of shown steps. */
  get beats(): { has(id: string): boolean; add(id: string): void } {
    return { has: (id) => this.seen('seenBeats', id), add: (id) => this.markSeen('seenBeats', id) };
  }

  /** Adds to the run totals (saved with the next clear or game over). */
  add(change: Partial<StoryStats>): void {
    const s = this.data.stats;
    s.martians += change.martians ?? 0;
    s.bosses += change.bosses ?? 0;
    s.livesLost += change.livesLost ?? 0;
    s.ticks += change.ticks ?? 0;
  }

  /**
   * The CrazyGames account's copy (SDK.data, once the SDK is ready): checked field by field, merged
   * with this one, saved to both places. Returns whether anything changed here (bad data = no change).
   */
  mergeAccount(raw: string | null): boolean {
    if (!raw) { this.save(); return false; } // nothing on the account yet: it gets our copy
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { this.save(); return false; }
    if (!parsed || typeof parsed !== 'object') { this.save(); return false; }
    const before = JSON.stringify(this.data);
    this.data = mergeSaved(this.data, sanitize(parsed as Partial<Saved>));
    this.save();
    return JSON.stringify(this.data) !== before;
  }

  save(): void {
    const json = JSON.stringify(this.data);
    try { localStorage.setItem(KEY, json); } catch { /* private mode */ }
    writeAccountData(KEY, json); // portal build with the SDK ready; otherwise nothing
  }
}
