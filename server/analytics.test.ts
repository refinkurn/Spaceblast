import { describe, expect, it } from 'vitest';
import { MAX_EVENTS, parseEvents, storeEvents, type EventsDb } from './analytics';

const NOW = Date.UTC(2026, 10, 3, 12);

describe('analytics events', () => {
  it('keeps valid events and stamps the server day', () => {
    const rows = parseEvents(JSON.stringify({ events: [
      { name: 'level_clear', level: 3, mode: 'story', value: 71 },
      { name: 'day', first: '2026-11-02', days: 1 },
    ] }), NOW);
    expect(rows).toEqual([
      { day: '2026-11-03', name: 'level_clear', level: 3, mode: 'story', value: 71, first_day: null, days: null },
      { day: '2026-11-03', name: 'day', level: null, mode: null, value: null, first_day: '2026-11-02', days: 1 },
    ]);
  });

  it('drops unknown names and clamps bad fields to null', () => {
    const rows = parseEvents(JSON.stringify({ events: [
      { name: 'hack' },
      { name: 'round', mode: 'evil', value: -5, level: 2.5, first: '2099-01-01', days: 4 },
    ] }), NOW);
    expect(rows).toEqual([
      { day: '2026-11-03', name: 'round', level: null, mode: null, value: null, first_day: null, days: null },
    ]);
  });

  it('refuses broken JSON and oversized batches', () => {
    expect(parseEvents('{', NOW)).toBeNull();
    expect(parseEvents(JSON.stringify({ events: Array(MAX_EVENTS + 1).fill({ name: 'day' }) }), NOW)).toBeNull();
  });

  it('writes one batch of inserts', async () => {
    const bound: unknown[][] = [];
    let batches = 0;
    const db: EventsDb = {
      prepare: () => ({ bind: (...v: unknown[]) => { bound.push(v); return v; } }),
      batch: async () => { batches++; },
    };
    await storeEvents(db, parseEvents(JSON.stringify({ events: [{ name: 'session_start' }, { name: 'session_end', value: 30 }] }), NOW)!);
    expect(batches).toBe(1);
    expect(bound[1]).toEqual(['2026-11-03', 'session_end', null, null, 30, null, null]);
  });
});
