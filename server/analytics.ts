// Game analytics: anonymous gameplay events, stored in D1 (Cloudflare's SQLite).
// No personal data: no player id, no IP, no cookies. Retention comes from
// 'day' events (one per device per day) that carry the day the device first
// played and how many days ago that was. Queries: docs/ANALYTICS.md.

/** Events the game may send; anything else is dropped. */
export const EVENT_NAMES = [
  'session_start', // page opened
  'day', // first session of a calendar day (retention)
  'session_end', // page hidden/closed; value = seconds played
  'level_start', 'level_clear', 'level_fail', // Story; level, value = seconds (clear/fail)
  'round', // a battle round ended; mode 'bot' | 'online', value = seconds
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const MODES = ['story', 'bot', 'online'] as const;

export interface GameEvent {
  name: EventName;
  /** Story level 1-20. */
  level?: number;
  mode?: (typeof MODES)[number];
  /** Seconds, rounded. */
  value?: number;
  /** UTC day the device first played, YYYY-MM-DD. */
  first?: string;
  /** Whole days since `first`. */
  days?: number;
}

export interface EventRow {
  day: string;
  name: string;
  level: number | null;
  mode: string | null;
  value: number | null;
  first_day: string | null;
  days: number | null;
}

export const MAX_EVENTS_BODY = 4096;
export const MAX_EVENTS = 20;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/** Checks a posted batch; returns only valid rows (bad ones are dropped, not fatal). */
export function parseEvents(text: string, now: number): EventRow[] | null {
  let body: unknown;
  try { body = JSON.parse(text); } catch { return null; }
  const list = (body as { events?: unknown })?.events;
  if (!Array.isArray(list) || list.length > MAX_EVENTS) return null;
  const day = new Date(now).toISOString().slice(0, 10);
  const rows: EventRow[] = [];
  for (const raw of list) {
    const e = raw as Record<string, unknown>;
    if (!e || !(EVENT_NAMES as readonly string[]).includes(e.name as string)) continue;
    const first = typeof e.first === 'string' && DAY_RE.test(e.first) && e.first <= day ? e.first : null;
    rows.push({
      day,
      name: e.name as string,
      level: int(e.level, 1, 99),
      mode: (MODES as readonly string[]).includes(e.mode as string) ? (e.mode as string) : null,
      value: int(e.value, 0, 86_400),
      first_day: first,
      days: first ? int(e.days, 0, 3650) : null,
    });
  }
  return rows;
}

export const SCHEMA = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  level INTEGER,
  mode TEXT,
  value INTEGER,
  first_day TEXT,
  days INTEGER
);
CREATE INDEX IF NOT EXISTS events_name_day ON events (name, day);`;

const INSERT = 'INSERT INTO events (day, name, level, mode, value, first_day, days) VALUES (?, ?, ?, ?, ?, ?, ?)';

/** Minimal D1 surface, so tests can pass a fake. */
export interface EventsDb {
  prepare(sql: string): { bind(...values: unknown[]): unknown };
  batch(statements: unknown[]): Promise<unknown>;
}

export async function storeEvents(db: EventsDb, rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const stmt = db.prepare(INSERT);
  await db.batch(rows.map((r) => stmt.bind(r.day, r.name, r.level, r.mode, r.value, r.first_day, r.days)));
}
