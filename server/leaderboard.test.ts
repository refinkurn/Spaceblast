import { describe, expect, it } from 'vitest';
import { maxScore } from '../src/services/score';
import { DAILY_POSTS, IP_DAILY_POSTS, Leaderboard, MemoryStore, STAGE_CAP, SqlStore, clientKey, scoresApi, validate, type SqlLike, type Store } from './leaderboard';
import { openSqlite } from './node_sqlite';

// node:sqlite (the Fly server's storage) stands in for Cloudflare's ctx.storage.sql, so the SQL is tested too.
const sqlite = (): SqlLike => openSqlite(':memory:');

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sub = (o: Record<string, unknown> = {}) => ({
  device_uuid: uuid(1),
  display_name: 'Ana',
  stage_id: 'stage_1_1',
  score: 5000,
  completion_time_seconds: 60,
  hearts_left: 3,
  stars: 3,
  ...o,
});

describe('leaderboard: validate', () => {
  it('accepts a good post and ignores extra fields', () => {
    const v = validate({ ...sub(), extra: 'x' });
    expect(v.ok && v.sub).toEqual(sub());
  });

  it('rejects bad bodies and fields with bad_<field>', () => {
    expect(validate(null)).toEqual({ ok: false, reason: 'bad_body' });
    expect(validate([sub()])).toEqual({ ok: false, reason: 'bad_body' });
    expect(validate(sub({ device_uuid: 'not-a-uuid' }))).toEqual({ ok: false, reason: 'bad_uuid' });
    expect(validate(sub({ device_uuid: uuid(1).toUpperCase().replace('0000-4', 'ABCD-4') }))).toEqual({ ok: false, reason: 'bad_uuid' });
    expect(validate(sub({ stage_id: 'stage_9_9' }))).toEqual({ ok: false, reason: 'bad_stage' });
    expect(validate(sub({ stage_id: 3 }))).toEqual({ ok: false, reason: 'bad_stage' });
    expect(validate(sub({ score: maxScore(1) + 1 }))).toEqual({ ok: false, reason: 'bad_score' });
    expect(validate(sub({ score: 10.5 }))).toEqual({ ok: false, reason: 'bad_score' });
    expect(validate(sub({ score: -1 }))).toEqual({ ok: false, reason: 'bad_score' });
    expect(validate(sub({ completion_time_seconds: 4 }))).toEqual({ ok: false, reason: 'bad_time' });
    expect(validate(sub({ completion_time_seconds: 3601 }))).toEqual({ ok: false, reason: 'bad_time' });
    expect(validate(sub({ hearts_left: 0 }))).toEqual({ ok: false, reason: 'bad_hearts' });
    expect(validate(sub({ stars: 4 }))).toEqual({ ok: false, reason: 'bad_stars' });
    expect(validate(sub({ score: maxScore(1) })).ok).toBe(true);
  });

  it('replaces a rude or missing name instead of rejecting', () => {
    for (const name of ['kontol', 'fuuuck', 'x', undefined]) {
      const v = validate(sub({ display_name: name }));
      expect(v.ok).toBe(true);
      if (v.ok) {
        expect(v.renamed).toBe(true);
        expect(v.sub.display_name).toMatch(/^Bosco_\d{3}$/);
      }
    }
  });
});

describe.each<[string, () => Store]>([
  ['MemoryStore', () => new MemoryStore()],
  ['SqlStore', () => new SqlStore(sqlite())],
])('leaderboard on %s', (_, makeStore) => {
  // Ranking, limits and names: made-up scores, so the score check is off here (tested below).
  const board = () => new Leaderboard(makeStore(), false);

  it('keeps only the best per device and stage; ties go to the faster time', () => {
    const lb = board();
    expect(lb.submit(sub({ score: 5000 }), 0)).toEqual({ ok: true, rank: 1, best: 5000, name: 'Ana' });
    expect(lb.submit(sub({ score: 4000 }), 10_000)).toEqual({ ok: true, rank: 1, best: 5000, name: 'Ana' });
    lb.submit(sub({ score: 5000, completion_time_seconds: 50 }), 20_000);
    lb.submit(sub({ score: 5000, completion_time_seconds: 70 }), 30_000);
    expect(lb.top('stage_1_1')!.top).toEqual([{ rank: 1, display_name: 'Ana', score: 5000, completion_time_seconds: 50, stars: 3 }]);
    lb.submit(sub({ stage_id: 'stage_1_2', score: 100 }), 40_000);
    expect(lb.top('stage_1_2')!.top).toHaveLength(1);
  });

  it('ranks by score, then seconds, then who got there first; top 10 only', () => {
    const lb = board();
    for (let i = 1; i <= 12; i++) lb.submit(sub({ device_uuid: uuid(i), display_name: `P${i}`, score: 1000 * (i % 4) }), i);
    lb.submit(sub({ device_uuid: uuid(20), display_name: 'Fast', score: 3000, completion_time_seconds: 30 }), 100);
    const t = lb.top('stage_1_1')!;
    expect(t.top).toHaveLength(10);
    expect(t.top.map((r) => r.display_name)).toEqual(['Fast', 'P3', 'P7', 'P11', 'P2', 'P6', 'P10', 'P1', 'P5', 'P9']);
    expect(t.top.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(t.you).toBeUndefined();
    // Rank in the POST reply; a later equal score ranks below.
    expect(lb.submit(sub({ device_uuid: uuid(30), score: 2000 }), 200)).toMatchObject({ ok: true, rank: 8, best: 2000 });
  });

  it('adds the asking device as `you`, even outside the top 10', () => {
    const lb = board();
    for (let i = 1; i <= 11; i++) lb.submit(sub({ device_uuid: uuid(i), score: 10_000 - i }), i);
    const t = lb.top('stage_1_1', uuid(11))!;
    expect(t.you).toEqual({ rank: 11, display_name: 'Ana', score: 9989, completion_time_seconds: 60, stars: 3 });
    expect(lb.top('stage_1_1', uuid(99))!.you).toBeUndefined();
    expect(lb.top('stage_1_1', 'junk')!.you).toBeUndefined();
    expect(lb.top('stage_0_1')).toBeNull();
  });

  it('rate-limits: 3 s between posts and a daily cap', () => {
    const lb = board();
    expect(lb.submit(sub(), 0).ok).toBe(true);
    expect(lb.submit(sub(), 2999)).toEqual({ ok: false, reason: 'too_fast' });
    expect(lb.submit(sub(), 3000).ok).toBe(true);
    const day = 86_400_000;
    let t = day * 5;
    for (let i = 0; i < DAILY_POSTS; i++, t += 3000) expect(lb.submit(sub(), t).ok).toBe(true);
    expect(lb.submit(sub(), t)).toEqual({ ok: false, reason: 'daily_limit' });
    expect(lb.submit(sub(), day * 6).ok).toBe(true); // new UTC day
    expect(lb.submit(sub({ device_uuid: uuid(2) }), day * 6).ok).toBe(true); // other devices unaffected
  });

  it('saves the latest valid name on every accepted post; a rude one keeps the old name', () => {
    const lb = board();
    lb.submit(sub({ score: 5000 }), 0);
    lb.submit(sub({ stage_id: 'stage_1_2', score: 10 }), 3000);
    expect(lb.submit(sub({ score: 1, display_name: 'Bo' }), 6000)).toMatchObject({ ok: true, best: 5000, name: 'Bo' });
    expect(lb.top('stage_1_1')!.top[0].display_name).toBe('Bo');
    expect(lb.top('stage_1_2')!.top[0].display_name).toBe('Bo');
    expect(lb.submit(sub({ display_name: 'anjing' }), 9000)).toMatchObject({ ok: true, name: 'Bo' });
    const fresh = lb.submit(sub({ device_uuid: uuid(2), display_name: 'bangsat' }), 9000);
    expect(fresh.ok && fresh.name).toMatch(/^Bosco_\d{3}$/);
  });
});

describe('leaderboard: HTTP route', () => {
  const url = (q = '') => new URL(`http://x/api/scores${q}`);

  it('maps replies to 200 / 400 / 429', () => {
    const lb = new Leaderboard(new MemoryStore(), false);
    expect(scoresApi(lb, 'POST', url(), JSON.stringify(sub()), 0).status).toBe(200);
    expect(scoresApi(lb, 'POST', url(), JSON.stringify(sub()), 1000)).toEqual({ status: 429, body: { ok: false, reason: 'too_fast' } });
    expect(scoresApi(lb, 'POST', url(), JSON.stringify(sub({ score: 1e9 })), 9000).status).toBe(400);
    expect(scoresApi(lb, 'POST', url(), '{nope', 9000)).toEqual({ status: 400, body: { ok: false, reason: 'bad_json' } });
    expect(scoresApi(lb, 'POST', url(), ' '.repeat(3000), 9000).status).toBe(400);
    expect(scoresApi(lb, 'GET', url('?stage=stage_1_1'), '', 0).status).toBe(200);
    expect(scoresApi(lb, 'GET', url('?stage=bad'), '', 0).status).toBe(400);
  });
});

describe('leaderboard hardening', () => {
  // A real level 1 clear: 2,000 + 3 hearts x 1,000 + (75 - 60) s x 20 + 3 Martians x 500 = 6,800, 3 stars.
  const real = sub({ score: 6800, completion_time_seconds: 60, hearts_left: 3, stars: 3 });

  it('accepts a score a real clear can produce, rejects one it cannot', () => {
    const lb = new Leaderboard(new MemoryStore());
    expect(lb.submit(real, 0)).toMatchObject({ ok: true, rank: 1, best: 6800 });
    expect(lb.submit(sub({ device_uuid: uuid(2), score: 6900 }), 0)).toEqual({ ok: false, reason: 'bad_score' }); // not a whole Martian
    expect(lb.submit(sub({ device_uuid: uuid(3), score: 6800, stars: 2 }), 0)).toEqual({ ok: false, reason: 'bad_score' }); // wrong stars
    expect(lb.submit(sub({ device_uuid: uuid(4), score: 6800, hearts_left: 1 }), 0)).toEqual({ ok: false, reason: 'bad_score' }); // hearts don't add up
  });

  for (const [name, makeStore] of [['MemoryStore', () => new MemoryStore()], ['SqlStore', () => new SqlStore(sqlite())]] as [string, () => Store][]) {
    it(`limits one network address whatever device ids it sends (${name})`, () => {
      const lb = new Leaderboard(makeStore(), false);
      for (let i = 0; i < IP_DAILY_POSTS; i++) expect(lb.submit(sub({ device_uuid: uuid(100 + i) }), 0, '203.0.113.7').ok).toBe(true);
      expect(lb.submit(sub({ device_uuid: uuid(9999) }), 0, '203.0.113.7')).toEqual({ ok: false, reason: 'daily_limit' });
      expect(lb.submit(sub({ device_uuid: uuid(9998) }), 0, '198.51.100.1').ok).toBe(true); // another address is fine
      expect(lb.submit(sub({ device_uuid: uuid(9997) }), 86_400_000, '203.0.113.7').ok).toBe(true); // a new day
    }, 30000); // 2,000 posts

    it(`keeps at most STAGE_CAP rows per stage, dropping the lowest (${name})`, () => {
      const store = makeStore();
      const lb = new Leaderboard(store, false);
      for (let i = 0; i < STAGE_CAP + 5; i++) lb.submit(sub({ device_uuid: uuid(i + 1), score: 1000 + i }), 0);
      expect(store.top('stage_1_1', STAGE_CAP + 10)).toHaveLength(STAGE_CAP);
      expect(store.best(uuid(1), 'stage_1_1')).toBeNull(); // the lowest went
      expect(store.top('stage_1_1', 1)[0].score).toBe(1000 + STAGE_CAP + 4);
    });

    it(`forgets old rate-limit records (${name})`, () => {
      const store = makeStore();
      store.setLimit('x', { last: 0, day: 3, count: 1 });
      store.setLimit('y', { last: 0, day: 5, count: 1 });
      store.pruneLimits(5);
      expect(store.limit('x')).toBeNull();
      expect(store.limit('y')).not.toBeNull();
    });
  }

  it('never stores the address itself, and a different salt gives a different key', () => {
    const k = clientKey('203.0.113.7', 's1');
    expect(k).toMatch(/^ip:[0-9a-z]+$/);
    expect(k).not.toContain('203');
    expect(clientKey('203.0.113.7', 's1')).toBe(k);
    expect(clientKey('203.0.113.7', 's2')).not.toBe(k);
    expect(clientKey('203.0.113.8', 's1')).not.toBe(k);
  });

  it('posts a device is refused for do not use the address budget', () => {
    const lb = new Leaderboard(new MemoryStore(), false, 'salt');
    expect(lb.submit(sub(), 0, '203.0.113.7').ok).toBe(true);
    for (let i = 0; i < 5; i++) expect(lb.submit(sub(), 100, '203.0.113.7')).toEqual({ ok: false, reason: 'too_fast' });
    const store = (lb as unknown as { store: Store }).store;
    expect(store.limit(clientKey('203.0.113.7', 'salt'))?.count).toBe(1);
  });
});
