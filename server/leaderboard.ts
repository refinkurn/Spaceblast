import { cleanName, defaultName } from '../src/services/name_filter';
import { levelOfStage, maxScore } from '../src/services/score';
import { UUID_RE, type ScoreRow, type ScoreSubmission, type SubmitReply, type TopScores } from '../src/services/leaderboard_types';
import { type Row, type Store } from './leaderboard_store';

// The online leaderboard, shared by the dev relay (MemoryStore) and the
// Cloudflare Durable Object (SqlStore), like room.ts is for rooms. Keeps each
// device's best per stage; scores above what a level allows are rejected.

export { MemoryStore, SqlStore, type Store, type SqlLike } from './leaderboard_store';

export const TOP_N = 10;
/** Minimum gap between a device's posts (ms). */
export const POST_GAP_MS = 3000;
/** Posts a device may make per UTC day. */
export const DAILY_POSTS = 300;
/** Largest POST body accepted (bytes). */
export const MAX_BODY = 2048;
const DAY_MS = 86_400_000;

export type Validated = { ok: true; sub: ScoreSubmission; renamed: boolean } | { ok: false; reason: string };

const intIn = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** Checks a POST body. A rude or invalid name is replaced (`renamed`), not rejected. */
export function validate(body: unknown): Validated {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, reason: 'bad_body' };
  const b = body as Record<string, unknown>;
  if (typeof b.device_uuid !== 'string' || !UUID_RE.test(b.device_uuid)) return { ok: false, reason: 'bad_uuid' };
  const level = typeof b.stage_id === 'string' ? levelOfStage(b.stage_id) : null;
  if (level === null) return { ok: false, reason: 'bad_stage' };
  if (!intIn(b.score, 0, maxScore(level))) return { ok: false, reason: 'bad_score' };
  if (!intIn(b.completion_time_seconds, 5, 3600)) return { ok: false, reason: 'bad_time' };
  if (!intIn(b.hearts_left, 1, 3)) return { ok: false, reason: 'bad_hearts' };
  if (!intIn(b.stars, 1, 3)) return { ok: false, reason: 'bad_stars' };
  const clean = cleanName(b.display_name);
  return {
    ok: true,
    renamed: clean === null,
    sub: {
      device_uuid: b.device_uuid,
      display_name: clean ?? defaultName(),
      stage_id: b.stage_id as string,
      score: b.score,
      completion_time_seconds: b.completion_time_seconds,
      hearts_left: b.hearts_left,
      stars: b.stars,
    },
  };
}

const scoreRow = (r: Row, rank: number): ScoreRow => ({
  rank,
  display_name: r.name,
  score: r.score,
  completion_time_seconds: r.seconds,
  stars: r.stars,
});

export class Leaderboard {
  constructor(private store: Store) {}

  /** A POST. `now` is ms since 1970. */
  submit(body: unknown, now: number): SubmitReply {
    const v = validate(body);
    if (!v.ok) return v;
    const s = v.sub;
    const device = s.device_uuid;

    const day = Math.floor(now / DAY_MS);
    const lim = this.store.limit(device);
    if (lim && now - lim.last < POST_GAP_MS) return { ok: false, reason: 'too_fast' };
    const count = lim && lim.day === day ? lim.count : 0;
    if (count >= DAILY_POSTS) return { ok: false, reason: 'daily_limit' };
    this.store.setLimit(device, { last: now, day, count: count + 1 });

    // A replaced (rude) name keeps the device's saved name if it has one.
    const name = v.renamed ? (this.store.nameOf(device) ?? s.display_name) : s.display_name;
    this.store.rename(device, name);

    const fresh: Row = { device, stage: s.stage_id, name, score: s.score, seconds: s.completion_time_seconds, stars: s.stars, at: now };
    const old = this.store.best(device, s.stage_id);
    const better = !old || fresh.score > old.score || (fresh.score === old.score && fresh.seconds < old.seconds);
    const best = better ? fresh : old;
    if (better) this.store.put(fresh);
    return { ok: true, rank: this.store.rankOf(best), best: best.score, name };
  }

  /** A GET: the top 10 of a stage, plus `you` if the device has a row there. Null for a bad stage. */
  top(stage: string, device?: string): TopScores | null {
    if (levelOfStage(stage) === null) return null;
    const out: TopScores = { stage_id: stage, top: this.store.top(stage, TOP_N).map((r, i) => scoreRow(r, i + 1)) };
    const mine = device && UUID_RE.test(device) ? this.store.best(device, stage) : null;
    if (mine) out.you = scoreRow(mine, this.store.rankOf(mine));
    return out;
  }
}

export interface ApiReply {
  status: number;
  body: unknown;
}

/**
 * The /api/scores route for any HTTP host: `bodyText` is the raw POST body
 * (the host checks MAX_BODY before reading too much). OPTIONS and CORS
 * headers are the host's job (see CORS_HEADERS).
 */
export function scoresApi(lb: Leaderboard, method: string, url: URL, bodyText: string, now: number): ApiReply {
  if (method === 'GET') {
    const res = lb.top(url.searchParams.get('stage') ?? '', url.searchParams.get('device') ?? undefined);
    return res ? { status: 200, body: res } : { status: 400, body: { ok: false, reason: 'bad_stage' } };
  }
  if (method !== 'POST') return { status: 405, body: { ok: false, reason: 'method' } };
  if (bodyText.length > MAX_BODY) return { status: 400, body: { ok: false, reason: 'bad_body' } };
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return { status: 400, body: { ok: false, reason: 'bad_json' } };
  }
  const reply = lb.submit(body, now);
  const status = reply.ok ? 200 : reply.reason === 'too_fast' || reply.reason === 'daily_limit' ? 429 : 400;
  return { status, body: reply };
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
export const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json', ...CORS_HEADERS };
