// Weekly metrics report (docs/design/metrics-report.md, run with `npm run metrics`).
// Pure: rows from the analytics database in, plain-text tables out. Not imported by
// the game, so it adds nothing to the bundle. The runner is scripts/metrics_report.mjs.

/** One aggregated row: events of one kind on one UTC day from one source. */
export interface MetricRow {
  day: string;
  /** 'site', 'crazygames', or null for rows stored before the source column existed. */
  src: string | null;
  name: string;
  level: number | null;
  mode: string | null;
  days: number | null;
  first_day: string | null;
  /** How many events. */
  n: number;
  /** Sum of their `value` (seconds). */
  value_sum: number | null;
  /** How many had value >= 60. */
  long_n: number | null;
}

/** The SQL the runner sends to D1 (one row per group; the week grouping is done here). */
export const METRICS_SQL = (since: string) =>
  `SELECT day, src, name, level, mode, days, first_day, COUNT(*) AS n, SUM(value) AS value_sum, SUM(value >= 60) AS long_n FROM events WHERE day >= '${since}' GROUP BY day, src, name, level, mode, days, first_day`;

export const SOURCES = ['site', 'crazygames', 'unknown'] as const;
type Source = (typeof SOURCES)[number];

const DAY = 86_400_000;
const sourceOf = (src: string | null): Source => (src === 'site' || src === 'crazygames' ? src : 'unknown');

/** The Monday (UTC) of the ISO week a YYYY-MM-DD day falls in. */
export function weekOf(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday 0 ... Sunday 6
  return new Date(t - dow * DAY).toISOString().slice(0, 10);
}

/** The Mondays of the last `weeks` ISO weeks up to and including `today`'s, oldest first. */
export function weeksUpTo(today: string, weeks: number): string[] {
  const last = Date.parse(`${weekOf(today)}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => new Date(last - (weeks - 1 - i) * 7 * DAY).toISOString().slice(0, 10));
}

interface Totals {
  players: number;
  newPlayers: number;
  d1: number;
  sessions: number;
  ends: number;
  endSeconds: number;
  longEnds: number;
  l1Starts: number;
  l1Clears: number;
  onlineRounds: number;
}
const zero = (): Totals => ({ players: 0, newPlayers: 0, d1: 0, sessions: 0, ends: 0, endSeconds: 0, longEnds: 0, l1Starts: 0, l1Clears: 0, onlineRounds: 0 });

/** Totals per week and source. */
export function weekTotals(rows: MetricRow[], weeks: string[]): Map<string, Record<Source, Totals>> {
  const out = new Map<string, Record<Source, Totals>>();
  for (const w of weeks) out.set(w, { site: zero(), crazygames: zero(), unknown: zero() });
  const at = (day: string, src: string | null) => out.get(weekOf(day))?.[sourceOf(src)];
  for (const r of rows) {
    const n = Number(r.n) || 0;
    const t = at(r.day, r.src);
    if (r.name === 'day') {
      if (t) t.players += n;
      if (t && r.days === 0) t.newPlayers += n;
      // Day-1 retention belongs to the week the player started in.
      if (r.days === 1 && r.first_day) {
        const c = at(r.first_day, r.src);
        if (c) c.d1 += n;
      }
    }
    if (!t) continue;
    if (r.name === 'session_start') t.sessions += n;
    if (r.name === 'session_end') {
      t.ends += n;
      t.endSeconds += Number(r.value_sum) || 0;
      t.longEnds += Number(r.long_n) || 0;
    }
    if (r.name === 'level_start' && r.level === 1) t.l1Starts += n;
    if (r.name === 'level_clear' && r.level === 1) t.l1Clears += n;
    if (r.name === 'round' && r.mode === 'online') t.onlineRounds += n;
  }
  return out;
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '-');
const ratio = (a: number, b: number, digits: number) => (b > 0 ? (a / b).toFixed(digits) : '-');

/** The report's numbers: name, then how to show one week of one source. */
export const COLUMNS: [string, (t: Totals) => string][] = [
  ['players', (t) => String(t.players)],
  ['new players', (t) => String(t.newPlayers)],
  ['d1 %', (t) => pct(t.d1, t.newPlayers)],
  ['sessions', (t) => String(t.sessions)],
  ['avg minutes', (t) => ratio(t.endSeconds / 60, t.ends, 1)],
  ['stayed 1 min %', (t) => pct(t.longEnds, t.ends)],
  ['story level 1 start %', (t) => pct(t.l1Starts, t.newPlayers)],
  ['level 1 clear %', (t) => pct(t.l1Clears, t.l1Starts)],
  ['online rounds / player', (t) => ratio(t.onlineRounds, t.players, 2)],
];

function table(head: string[], rows: string[][]): string {
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(width[i]) : c.padStart(width[i]))).join('  ').trimEnd();
  return [line(head), width.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

/** Story starts / clears / fails per level over the whole window, per source. */
export function dropOff(rows: MetricRow[], from: string): string {
  const per = new Map<number, Record<Source, [number, number, number]>>();
  for (const r of rows) {
    if (r.day < from || r.level === null || !['level_start', 'level_clear', 'level_fail'].includes(r.name)) continue;
    const row = per.get(r.level) ?? { site: [0, 0, 0], crazygames: [0, 0, 0], unknown: [0, 0, 0] };
    row[sourceOf(r.src)][['level_start', 'level_clear', 'level_fail'].indexOf(r.name)] += Number(r.n) || 0;
    per.set(r.level, row);
  }
  if (per.size === 0) return 'Story drop-off: no Story levels played in this window.';
  const levels = [...per.keys()].sort((a, b) => a - b);
  const cell = (v: [number, number, number]) => (v[0] + v[1] + v[2] ? `${v[0]}/${v[1]}/${v[2]}` : '-');
  return `Story drop-off (starts/clears/fails)\n${table(['level', ...SOURCES], levels.map((l) => [String(l), ...SOURCES.map((s) => cell(per.get(l)![s]))]))}`;
}

/** The whole report as plain text. */
export function report(rows: MetricRow[], today: string, weeks = 8): string {
  const ws = weeksUpTo(today, weeks);
  const totals = weekTotals(rows, ws);
  const label = (w: string) => `w/c ${w}`;
  const parts = [`Spaceblast weekly metrics (ISO weeks, UTC; week of ${weekOf(today)} is still running)`];
  for (const [name, show] of COLUMNS) {
    parts.push(`${name}\n${table(['week', ...SOURCES], ws.map((w) => [label(w), ...SOURCES.map((s) => show(totals.get(w)![s]))]))}`);
  }
  parts.push(dropOff(rows, ws[0]));
  return parts.join('\n\n');
}
