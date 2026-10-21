import { describe, expect, it } from 'vitest';
import { LeaderboardApi, type Storage } from './leaderboardApi';
import type { ScoreSubmission } from './leaderboard_types';

const memory = (): Storage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const sub = (stage: string, score: number): ScoreSubmission => ({
  device_uuid: '00000000-0000-4000-8000-000000000000', display_name: 'Bosco_123', stage_id: stage,
  score, completion_time_seconds: 40, hearts_left: 3, stars: 3,
});

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('leaderboard client', () => {
  it('keeps scores queued while offline and sends them later', async () => {
    const store = memory();
    let online = false;
    const sent: ScoreSubmission[] = [];
    const api = new LeaderboardApi(((_: string, init?: RequestInit) => {
      if (!online) return Promise.reject(new TypeError('offline'));
      sent.push(JSON.parse(String(init?.body)));
      return reply(200, { ok: true, rank: 1, best: 5000, name: 'Bosco_123' });
    }) as typeof fetch, store, '', 0);
    expect(await api.submit(sub('stage_1_1', 5000))).toBeNull();
    await api.submit(sub('stage_1_2', 4000));
    expect(api.pending).toBe(2);
    online = true;
    await api.flush();
    expect(sent.map((s) => s.stage_id)).toEqual(['stage_1_1', 'stage_1_2']);
    expect(api.pending).toBe(0);
  });

  it('keeps only the best waiting score per stage', async () => {
    const api = new LeaderboardApi((() => Promise.reject(new TypeError('offline'))) as typeof fetch, memory(), '', 0);
    await api.submit(sub('stage_1_1', 5000));
    await api.submit(sub('stage_1_1', 3000));
    await api.submit(sub('stage_1_1', 7000));
    expect(api.pending).toBe(1);
  });

  it('retries later when busy, drops a score the server rejects', async () => {
    let status = 429;
    const api = new LeaderboardApi((() => reply(status, { ok: false, reason: status === 429 ? 'too_fast' : 'bad_score' })) as typeof fetch, memory(), '', 0);
    await api.submit(sub('stage_1_1', 5000));
    expect(api.pending).toBe(1);
    status = 400;
    const r = await api.flush();
    expect(r.get('stage_1_1')).toEqual({ ok: false, reason: 'bad_score' });
    expect(api.pending).toBe(0);
  });

  it('reads the top scores, or null when offline', async () => {
    const top = { stage_id: 'stage_1_1', top: [] };
    let url = '';
    const api = new LeaderboardApi(((u: string) => { url = u; return reply(200, top); }) as typeof fetch, memory(), 'https://x.test', 0);
    expect(await api.top('stage_1_1', 'abc')).toEqual(top);
    expect(url).toBe('https://x.test/api/scores?stage=stage_1_1&device=abc');
    const off = new LeaderboardApi((() => Promise.reject(new TypeError('offline'))) as typeof fetch, memory(), '', 0);
    expect(await off.top('stage_1_1', 'abc')).toBeNull();
  });
});
