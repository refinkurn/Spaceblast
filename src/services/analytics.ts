// Anonymous game analytics (server side: server/analytics.ts, queries: docs/ANALYTICS.md).
// No player id and no cookies: events carry only the level, mode, seconds, and
// for retention the day this device first played. Events wait in a small batch
// and go out every 15 s, when it fills, or when the page is hidden.

export type AnalyticsEvent = {
  name: 'session_start' | 'day' | 'session_end' | 'level_start' | 'level_clear' | 'level_fail' | 'round';
  level?: number;
  mode?: 'story' | 'bot' | 'online';
  value?: number;
  first?: string;
  days?: number;
};

const BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '';
const FIRST_KEY = 'spaceblast.firstDay';
const LAST_KEY = 'spaceblast.lastDay';
const BATCH = 20;
const EVERY_MS = 15_000;

export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** The once-a-day retention event, or null if this device already sent one today. */
export function dailyEvent(store: KeyStore | null, now: number): AnalyticsEvent | null {
  const today = utcDay(now);
  let first = today;
  let last: string | null = null;
  try {
    first = store?.getItem(FIRST_KEY) ?? today;
    last = store?.getItem(LAST_KEY) ?? null;
    store?.setItem(FIRST_KEY, first);
    store?.setItem(LAST_KEY, today);
  } catch { /* private mode: still counts the session */ }
  if (last === today) return null;
  return { name: 'day', first, days: Math.max(0, dayDiff(first, today)) };
}

export class Analytics {
  private queue: AnalyticsEvent[] = [];
  private started = 0;
  private ended = false;

  constructor(
    private send: (body: string) => void,
    private now: () => number = Date.now,
  ) {}

  track(e: AnalyticsEvent): void {
    this.queue.push(e);
    if (this.queue.length >= BATCH) this.flush();
  }

  flush(): void {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, BATCH);
    try { this.send(JSON.stringify({ events })); } catch { /* analytics never breaks the game */ }
  }

  /** Page opened: session start plus the daily retention event. */
  start(store: KeyStore | null): void {
    this.started = this.now();
    this.track({ name: 'session_start' });
    const daily = dailyEvent(store, this.started);
    if (daily) this.track(daily);
  }

  /** Page hidden: report the session length so far once, and send everything. */
  end(): void {
    if (!this.ended && this.started > 0) {
      this.ended = true;
      this.track({ name: 'session_end', value: Math.round((this.now() - this.started) / 1000) });
    }
    this.flush();
  }

  /** Back from the background: a new session starts counting. */
  resume(): void {
    if (!this.ended) return;
    this.ended = false;
    this.started = this.now();
    this.track({ name: 'session_start' });
  }
}

function beacon(body: string): void {
  // A text/plain beacon needs no CORS preflight and survives the page closing.
  if (!navigator.sendBeacon?.(`${BASE}/api/events`, body)) {
    void fetch(`${BASE}/api/events`, { method: 'POST', body, keepalive: true }).catch(() => {});
  }
}

/** The game's one instance. Silent in dev (`npm run dev` has no /api/events). */
export const analytics = new Analytics(import.meta.env?.DEV ? () => {} : beacon);

export function installAnalytics(): void {
  if (typeof window === 'undefined') return;
  let store: KeyStore | null = null;
  try { store = localStorage; } catch { /* blocked storage */ }
  analytics.start(store);
  setInterval(() => analytics.flush(), EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') analytics.end();
    else analytics.resume();
  });
  window.addEventListener('pagehide', () => analytics.end());
}
