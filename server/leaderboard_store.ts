// Leaderboard storage: one best row per device and stage, plus rate-limit
// counters. MemoryStore runs in `npm run dev` and the tests; SqlStore runs in
// the Cloudflare Durable Object (ctx.storage.sql, SQLite). Both order rows
// the same way: score desc, seconds asc, earlier `at` first, then device id
// (so the order is total and ranks never shift between reads).

export interface Row {
  device: string;
  stage: string;
  name: string;
  score: number;
  seconds: number;
  stars: number;
  /** When this best was set (ms since 1970). */
  at: number;
}

export interface Limit {
  /** Last accepted post (ms). */
  last: number;
  /** UTC day number of `count`. */
  day: number;
  count: number;
}

export interface Store {
  best(device: string, stage: string): Row | null;
  /** Inserts or replaces the device's row for the stage. */
  put(row: Row): void;
  /** The device's saved name (from any stage), or null if it has none. */
  nameOf(device: string): string | null;
  /** Sets the name on every row of the device. */
  rename(device: string, name: string): void;
  top(stage: string, n: number): Row[];
  /** 1-based rank the row has on its stage. */
  rankOf(row: Row): number;
  limit(device: string): Limit | null;
  setLimit(device: string, limit: Limit): void;
}

/** True if a ranks above b. */
export function above(a: Row, b: Row): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.seconds !== b.seconds) return a.seconds < b.seconds;
  if (a.at !== b.at) return a.at < b.at;
  return a.device < b.device;
}

export class MemoryStore implements Store {
  private rows = new Map<string, Row>();
  private limits = new Map<string, Limit>();
  private static key = (device: string, stage: string) => `${device}|${stage}`;

  best(device: string, stage: string): Row | null {
    const r = this.rows.get(MemoryStore.key(device, stage));
    return r ? { ...r } : null;
  }
  put(row: Row): void {
    this.rows.set(MemoryStore.key(row.device, row.stage), { ...row });
  }
  nameOf(device: string): string | null {
    for (const r of this.rows.values()) if (r.device === device) return r.name;
    return null;
  }
  rename(device: string, name: string): void {
    for (const r of this.rows.values()) if (r.device === device) r.name = name;
  }
  top(stage: string, n: number): Row[] {
    return this.stage(stage).sort((a, b) => (above(a, b) ? -1 : 1)).slice(0, n).map((r) => ({ ...r }));
  }
  rankOf(row: Row): number {
    return 1 + this.stage(row.stage).filter((r) => above(r, row)).length;
  }
  limit(device: string): Limit | null {
    const l = this.limits.get(device);
    return l ? { ...l } : null;
  }
  setLimit(device: string, limit: Limit): void {
    this.limits.set(device, { ...limit });
  }
  private stage(stage: string): Row[] {
    return [...this.rows.values()].filter((r) => r.stage === stage);
  }
}

/** The part of Cloudflare's SqlStorage this needs (also easy to fake with node:sqlite). */
export interface SqlLike {
  exec(query: string, ...bindings: (string | number)[]): { toArray(): Record<string, unknown>[] };
}

const ROW_COLS = 'device, stage, name, score, seconds, stars, at';
const toRow = (r: Record<string, unknown>): Row => ({
  device: String(r.device),
  stage: String(r.stage),
  name: String(r.name),
  score: Number(r.score),
  seconds: Number(r.seconds),
  stars: Number(r.stars),
  at: Number(r.at),
});

export class SqlStore implements Store {
  constructor(private sql: SqlLike) {
    sql.exec(`CREATE TABLE IF NOT EXISTS scores (device TEXT NOT NULL, stage TEXT NOT NULL, name TEXT NOT NULL,
      score INT NOT NULL, seconds INT NOT NULL, stars INT NOT NULL, at INT NOT NULL, PRIMARY KEY (device, stage))`);
    sql.exec('CREATE INDEX IF NOT EXISTS scores_rank ON scores (stage, score DESC, seconds ASC)');
    sql.exec('CREATE TABLE IF NOT EXISTS limits (device TEXT PRIMARY KEY, last INT NOT NULL, day INT NOT NULL, count INT NOT NULL)');
  }

  best(device: string, stage: string): Row | null {
    const r = this.sql.exec(`SELECT ${ROW_COLS} FROM scores WHERE device = ? AND stage = ?`, device, stage).toArray()[0];
    return r ? toRow(r) : null;
  }
  put(row: Row): void {
    this.sql.exec(
      `INSERT INTO scores (${ROW_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (device, stage) DO UPDATE SET name = excluded.name, score = excluded.score,
       seconds = excluded.seconds, stars = excluded.stars, at = excluded.at`,
      row.device, row.stage, row.name, row.score, row.seconds, row.stars, row.at,
    );
  }
  nameOf(device: string): string | null {
    const r = this.sql.exec('SELECT name FROM scores WHERE device = ? LIMIT 1', device).toArray()[0];
    return r ? String(r.name) : null;
  }
  rename(device: string, name: string): void {
    this.sql.exec('UPDATE scores SET name = ? WHERE device = ?', name, device);
  }
  top(stage: string, n: number): Row[] {
    return this.sql
      .exec(`SELECT ${ROW_COLS} FROM scores WHERE stage = ? ORDER BY score DESC, seconds ASC, at ASC, device ASC LIMIT ?`, stage, n)
      .toArray()
      .map(toRow);
  }
  rankOf(row: Row): number {
    const r = this.sql
      .exec(
        `SELECT COUNT(*) AS n FROM scores WHERE stage = ? AND (score > ? OR (score = ? AND (seconds < ?
         OR (seconds = ? AND (at < ? OR (at = ? AND device < ?))))))`,
        row.stage, row.score, row.score, row.seconds, row.seconds, row.at, row.at, row.device,
      )
      .toArray()[0];
    return 1 + Number(r?.n ?? 0);
  }
  limit(device: string): Limit | null {
    const r = this.sql.exec('SELECT last, day, count FROM limits WHERE device = ?', device).toArray()[0];
    return r ? { last: Number(r.last), day: Number(r.day), count: Number(r.count) } : null;
  }
  setLimit(device: string, l: Limit): void {
    this.sql.exec(
      `INSERT INTO limits (device, last, day, count) VALUES (?, ?, ?, ?)
       ON CONFLICT (device) DO UPDATE SET last = excluded.last, day = excluded.day, count = excluded.count`,
      device, l.last, l.day, l.count,
    );
  }
}
