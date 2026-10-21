import type { ScoreSubmission, SubmitReply, TopScores } from './leaderboard_types';

// The online leaderboard client. Scores go into a small queue in localStorage
// first and are sent from there, so a score made offline (or while the server
// is down) is sent the next time the game is online. Only the best score per
// stage waits in the queue.

const QUEUE_KEY = 'spaceblast.scoreQueue';
const MAX_QUEUE = 20;
/** Same origin as the game by default; the phone apps set VITE_API_BASE. */
const BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LeaderboardApi {
  private sending = false;

  constructor(
    private fetcher: typeof fetch = (...a) => fetch(...a),
    private store: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
    private base = BASE,
    /** Pause between queued sends (the server takes one per device every 3 s). */
    private gapMs = 3200,
  ) {}

  /** Queues a finished stage and tries to send everything waiting. */
  async submit(sub: ScoreSubmission): Promise<SubmitReply | null> {
    const queue = this.queue().filter((q) => q.stage_id !== sub.stage_id || q.score > sub.score);
    if (!queue.some((q) => q.stage_id === sub.stage_id)) queue.push(sub);
    this.save(queue.slice(-MAX_QUEUE));
    const replies = await this.flush();
    return replies.get(sub.stage_id) ?? null;
  }

  /** Sends what is waiting, oldest first. Keeps whatever fails because of the network. */
  async flush(): Promise<Map<string, SubmitReply>> {
    const replies = new Map<string, SubmitReply>();
    if (this.sending) return replies;
    this.sending = true;
    try {
      let first = true;
      for (const sub of this.queue()) {
        if (!first && this.gapMs > 0) await new Promise((r) => setTimeout(r, this.gapMs));
        first = false;
        let reply: SubmitReply;
        try {
          const res = await this.fetcher(`${this.base}/api/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          });
          // Busy (429) or server trouble (5xx): try again later. Other 4xx: the
          // score was rejected for good, so it leaves the queue.
          if (res.status === 429 || res.status >= 500) break;
          reply = (await res.json()) as SubmitReply;
        } catch {
          break; // offline
        }
        replies.set(sub.stage_id, reply);
        this.save(this.queue().filter((q) => !(q.stage_id === sub.stage_id && q.score === sub.score)));
      }
    } finally {
      this.sending = false;
    }
    return replies;
  }

  /** Top 10 for a stage plus this device's row; null when offline. */
  async top(stageId: string, device: string): Promise<TopScores | null> {
    try {
      const res = await this.fetcher(`${this.base}/api/scores?stage=${encodeURIComponent(stageId)}&device=${encodeURIComponent(device)}`);
      if (!res.ok) return null;
      return (await res.json()) as TopScores;
    } catch {
      return null;
    }
  }

  get pending(): number {
    return this.queue().length;
  }

  private queue(): ScoreSubmission[] {
    try {
      const raw = JSON.parse(this.store?.getItem(QUEUE_KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? (raw as ScoreSubmission[]).filter((q) => q && typeof q.stage_id === 'string') : [];
    } catch {
      return [];
    }
  }

  private save(queue: ScoreSubmission[]): void {
    try { this.store?.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch { /* private mode */ }
  }
}

/** The game's one client; sends waiting scores whenever the browser comes back online. */
export const leaderboard = new LeaderboardApi();
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void leaderboard.flush());
  // On start-up too, for scores left from an offline session.
  setTimeout(() => void leaderboard.flush(), 3000);
}
