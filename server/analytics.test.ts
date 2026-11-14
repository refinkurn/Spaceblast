import { describe, expect, it } from 'vitest';
import { MAX_EVENTS, parseEvents, storeEvents, type EventsDb } from './analytics';

const NOW = Date.UTC(2026, 10, 3, 12);

describe('analytics events', () => {
  it('keeps valid events and stamps the server day', () => {
    const rows = parseEvents(JSON.stringify({ events: [
      { name: 'level_clear', level: 3, mode: 'story', value: 71, src: 'crazygames' },
      { name: 'day', first: '2026-11-02', days: 1 },
    ] }), NOW);
    expect(rows).toEqual([
      { day: '2026-11-03', name: 'level_clear', level: 3, mode: 'story', value: 71, first_day: null, days: null, src: 'crazygames' },
      { day: '2026-11-03', name: 'day', level: null, mode: null, value: null, first_day: '2026-11-02', days: 1, src: null },
    ]);
  });

  it('drops unknown names and clamps bad fields to null', () => {
    const rows = parseEvents(JSON.stringify({ events: [
      { name: 'hack' },
      { name: 'round', mode: 'evil', value: -5, level: 2.5, first: '2099-01-01', days: 4, src: 'elsewhere' },
    ] }), NOW);
    expect(rows).toEqual([
      { day: '2026-11-03', name: 'round', level: null, mode: null, value: null, first_day: null, days: null, src: null },
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
    await storeEvents(db, parseEvents(JSON.stringify({ events: [{ name: 'session_start' }, { name: 'session_end', value: 30, src: 'site' }] }), NOW)!);
    expect(batches).toBe(1);
    expect(bound[1]).toEqual(['2026-11-03', 'session_end', null, null, 30, null, null, 'site']);
  });

  it('still stores events in a database that has no src column yet', async () => {
    const batches: unknown[][][] = [];
    const db: EventsDb = {
      prepare: (sql: string) => ({ bind: (...v: unknown[]) => [sql.includes('src'), ...v] }),
      batch: async (statements: unknown[]) => {
        if ((statements[0] as unknown[])[0]) throw new Error('table events has no column named src');
        batches.push(statements as unknown[][]);
      },
    };
    await storeEvents(db, parseEvents(JSON.stringify({ events: [{ name: 'round', mode: 'bot', value: 40, src: 'crazygames' }] }), NOW)!);
    expect(batches).toHaveLength(1);
    expect(batches[0][0]).toEqual([false, '2026-11-03', 'round', null, 'bot', 40, null, null]);
  });

  it('does not hide other database failures behind the fallback', async () => {
    const db: EventsDb = {
      prepare: () => ({ bind: (...v: unknown[]) => v }),
      batch: async () => { throw new Error('D1 overloaded'); },
    };
    await expect(storeEvents(db, parseEvents(JSON.stringify({ events: [{ name: 'round' }] }), NOW)!)).rejects.toThrow('overloaded');
  });
});
