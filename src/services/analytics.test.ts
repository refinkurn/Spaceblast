import { describe, expect, it } from 'vitest';
import { Analytics, dailyEvent, type KeyStore } from './analytics';

const day = (d: number) => Date.UTC(2026, 10, d, 9);
const memory = (): KeyStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('analytics client', () => {
  it('sends the daily event once a day with days since first play', () => {
    const store = memory();
    expect(dailyEvent(store, day(3))).toEqual({ name: 'day', first: '2026-11-03', days: 0 });
    expect(dailyEvent(store, day(3))).toBeNull();
    expect(dailyEvent(store, day(4))).toEqual({ name: 'day', first: '2026-11-03', days: 1 });
    expect(dailyEvent(store, day(10))).toEqual({ name: 'day', first: '2026-11-03', days: 7 });
  });

  it('batches events and reports the session length once on hide', () => {
    const sent: { name: string; value?: number }[][] = [];
    let now = day(3);
    const a = new Analytics((body) => sent.push(JSON.parse(body).events), () => now);
    a.start(memory());
    a.track({ name: 'level_start', level: 1, mode: 'story' });
    now += 95_000;
    a.end();
    a.end();
    expect(sent).toHaveLength(1);
    expect(sent[0].map((e) => e.name)).toEqual(['session_start', 'day', 'level_start', 'session_end']);
    expect(sent[0][3].value).toBe(95);
    a.resume();
    now += 10_000;
    a.end();
    expect(sent[1].map((e) => [e.name, e.value])).toEqual([['session_start', undefined], ['session_end', 10]]);
  });

  it('tags every sent event with where the page runs', () => {
    const sent: { name: string; src?: string }[][] = [];
    const a = new Analytics((body) => sent.push(JSON.parse(body).events));
    a.track({ name: 'round', mode: 'bot', value: 40 });
    a.flush();
    expect(sent[0][0].src).toBe('site');
  });

  it('never throws when sending fails', () => {
    const a = new Analytics(() => { throw new Error('offline'); });
    a.track({ name: 'round', mode: 'bot', value: 40 });
    expect(() => a.flush()).not.toThrow();
  });
});
