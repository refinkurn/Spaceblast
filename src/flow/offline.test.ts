import { describe, expect, it } from 'vitest';
import { clearStaleReload, reloadOnceIfStale } from './offline';

function fakeStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

describe('stale tab reload', () => {
  it('reloads once, then never loops', () => {
    const store = fakeStore();
    let reloads = 0;
    expect(reloadOnceIfStale(store, () => reloads++)).toBe(true);
    expect(reloadOnceIfStale(store, () => reloads++)).toBe(false);
    expect(reloads).toBe(1);
  });

  it('re-arms after a clean start', () => {
    const store = fakeStore();
    let reloads = 0;
    reloadOnceIfStale(store, () => reloads++);
    clearStaleReload(store);
    expect(reloadOnceIfStale(store, () => reloads++)).toBe(true);
    expect(reloads).toBe(2);
  });

  it('does not reload without storage (cannot guard the loop)', () => {
    let reloads = 0;
    expect(reloadOnceIfStale(null, () => reloads++)).toBe(false);
    expect(reloads).toBe(0);
  });
});
