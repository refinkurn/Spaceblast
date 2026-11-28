import { describe, expect, it } from 'vitest';
import { report, weekOf, weekTotals, weeksUpTo, type MetricRow } from './metrics_report';
import fixture from './metrics_report.fixture.json';

const row = (r: Partial<MetricRow>): MetricRow => ({ day: '2026-11-23', src: 'site', name: 'day', level: null, mode: null, days: null, first_day: null, n: 1, value_sum: null, long_n: null, ...r });

describe('metrics report', () => {
  it('groups days into ISO weeks starting on Monday (UTC)', () => {
    expect(weekOf('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(weekOf('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(weekOf('2026-11-30')).toBe('2026-11-30');
    expect(weeksUpTo('2026-11-28', 3)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
  });

  it('counts day-1 retention in the week the player started', () => {
    const t = weekTotals([
      row({ day: '2026-11-22', days: 0, first_day: '2026-11-22', n: 4 }), // Sunday, week of 16th
      row({ day: '2026-11-23', days: 1, first_day: '2026-11-22', n: 1 }), // came back Monday
    ], ['2026-11-16', '2026-11-23']);
    expect(t.get('2026-11-16')!.site.newPlayers).toBe(4);
    expect(t.get('2026-11-16')!.site.d1).toBe(1);
    expect(t.get('2026-11-23')!.site.d1).toBe(0);
  });

  it('prints "-" instead of dividing by zero, and keeps sources apart', () => {
    const text = report([row({ src: 'crazygames', name: 'session_end', n: 2, value_sum: 150, long_n: 1 })], '2026-11-28', 1);
    expect(text).not.toMatch(/NaN|Infinity/);
    const stayed = text.split('\n\n').find((p) => p.startsWith('stayed 1 min %'))!;
    expect(stayed).toMatch(/w\/c 2026-11-23\s+-\s+50%\s+-/);
    const avg = text.split('\n\n').find((p) => p.startsWith('avg minutes'))!;
    expect(avg).toMatch(/1\.3/);
  });

  it('reads the fixture into every table and a drop-off table', () => {
    const text = report(fixture as MetricRow[], '2026-11-28', 2);
    for (const name of ['players', 'new players', 'd1 %', 'sessions', 'avg minutes', 'stayed 1 min %', 'story level 1 start %', 'level 1 clear %', 'online rounds / player']) {
      expect(text).toContain(`\n\n${name}\n`);
    }
    expect(text).toContain('Story drop-off');
    expect(text).toMatch(/\n1\s+-\s+2\/1\/1/); // level 1: crazygames 2 starts, 1 clear, 1 fail
    const unknown = text.split('\n\n').find((p) => p.startsWith('players\n'))!;
    expect(unknown).toMatch(/w\/c 2026-11-16\s+1\s+0\s+3/);
  });
});
