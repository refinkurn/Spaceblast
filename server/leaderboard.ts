import { cleanName, defaultName } from '../src/services/name_filter';
import { levelOfStage, maxScore, scoreConsistent } from '../src/services/score';
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
/**
 * Posts per UTC day from one network address, whatever device ids it sends
 * (random ids would get round the per-device limit). Generous: a whole office
 * or school can share one address.
 */
export const IP_DAILY_POSTS = 2000;
/** Rows kept per stage: past this the lowest one goes, so random ids can't grow the table forever. */
export const STAGE_CAP = 500;
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

/**
 * A key for a network address, only used for rate limits: a 53-bit hash mixed
 * with a salt that is random per server instance and never stored, so the
 * stored key can't be turned back into an address by trying every IPv4.
 */
export function clientKey(address: string, salt: string): string {
  const text = salt + '|' + address;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `ip:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

function randomSalt(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export class Leaderboard {
  /** UTC day the old rate-limit records were last cleared. */
  private prunedDay = -1;

  /** `checkScores`: reject rows a real clear can't produce (tests of ranking turn it off). */
  /** `salt`: for clientKey; random per instance unless a test fixes it. */
  constructor(private store: Store, private checkScores = true, private salt = randomSalt()) {}

  /** A POST. `now` is ms since 1970; `client` is the sender's network address when the host knows it. */
  submit(body: unknown, now: number, client?: string): SubmitReply {
    const v = validate(body);
    if (!v.ok) return v;
    const s = v.sub;
    const device = s.device_uuid;
    // The score, time, hearts and stars must fit together the way the game computes them.
    if (this.checkScores && !scoreConsistent(levelOfStage(s.stage_id)!, s.score, s.completion_time_seconds, s.hearts_left, s.stars)) {
      return { ok: false, reason: 'bad_score' };
    }

    const day = Math.floor(now / DAY_MS);
    if (day !== this.prunedDay) {
      this.prunedDay = day;
      this.store.pruneLimits(day - 1);
    }
    // The device's own limits first, so posts refused there don't use up the address's budget.
    const lim = this.store.limit(device);
    if (lim && now - lim.last < POST_GAP_MS) return { ok: false, reason: 'too_fast' };
    const count = lim && lim.day === day ? lim.count : 0;
    if (count >= DAILY_POSTS) return { ok: false, reason: 'daily_limit' };
    if (client) {
      const key = clientKey(client, this.salt);
      const ip = this.store.limit(key);
      const ipCount = ip && ip.day === day ? ip.count : 0;
      if (ipCount >= IP_DAILY_POSTS) return { ok: false, reason: 'daily_limit' };
      this.store.setLimit(key, { last: now, day, count: ipCount + 1 });
    }
    this.store.setLimit(device, { last: now, day, count: count + 1 });

    // A replaced (rude) name keeps the device's saved name if it has one.
    const name = v.renamed ? (this.store.nameOf(device) ?? s.display_name) : s.display_name;
    this.store.rename(device, name);

    const fresh: Row = { device, stage: s.stage_id, name, score: s.score, seconds: s.completion_time_seconds, stars: s.stars, at: now };
    const old = this.store.best(device, s.stage_id);
    const better = !old || fresh.score > old.score || (fresh.score === old.score && fresh.seconds < old.seconds);
    const best = better ? fresh : old;
    if (better) {
      this.store.put(fresh);
      this.store.trim(s.stage_id, STAGE_CAP);
    }
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
export function scoresApi(lb: Leaderboard, method: string, url: URL, bodyText: string, now: number, client?: string): ApiReply {
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
  const reply = lb.submit(body, now, client);
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
