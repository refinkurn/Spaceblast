import { describe, expect, it } from 'vitest';
import { BUILD, UPDATE_RETRY_MS, reloadForUpdate } from './build';
import { cleanVersion } from './protocol';

function store() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('build version on the page', () => {
  it('is dev in tests, and a valid join version', () => {
    expect(BUILD).toBe('dev');
    expect(cleanVersion(BUILD)).toBe(BUILD);
  });

  it("an 'update' refusal reloads once; a second one soon after shows the message instead (no loop)", () => {
    const s = store();
    let reloads = 0;
    const go = () => { reloads++; };
    expect(reloadForUpdate(s, 1000, go)).toBe(true);
    expect(reloadForUpdate(s, 5000, go)).toBe(false);
    expect(reloadForUpdate(s, 1000 + UPDATE_RETRY_MS - 1, go)).toBe(false);
    expect(reloads).toBe(1);
    // Much later (another deploy): one more reload is allowed.
    expect(reloadForUpdate(s, 1000 + UPDATE_RETRY_MS, go)).toBe(true);
    expect(reloads).toBe(2);
  });

  it('never reloads when it cannot remember that it did (no storage, or storage throws)', () => {
    let reloads = 0;
    const go = () => { reloads++; };
    expect(reloadForUpdate(null, 0, go)).toBe(false);
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(reloadForUpdate(broken, 0, go)).toBe(false);
    expect(reloads).toBe(0);
  });
});
