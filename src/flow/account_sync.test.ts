import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk, type CrazyUser } from '../services/crazygames';
import { watchAccountMerge } from './account_sync';
import { KEY, StoryProgress } from './progress';

const ok = () => Promise.resolve();

afterEach(() => { resetCrazySdk(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('watchAccountMerge', () => {
  it('a login during play merges the account copy again, keeping progress made before', async () => {
    const store: Record<string, string> = {};
    let login: (u: CrazyUser | null) => void = () => {};
    const sdk: CrazySdk = {
      init: ok, environment: 'crazygames',
      data: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
      user: { isUserAccountAvailable: true, getUser: () => Promise.resolve(null), addAuthListener: (l) => { login = l; } },
    };
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    const p = new StoryProgress();
    const changed = vi.fn();
    watchAccountMerge(p, changed);
    await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
    changed.mockClear();
    // Progress made while logged out, then the account (with its own copy) logs in.
    p.save();
    store[KEY] = JSON.stringify({ unlocked: 9, stars: { 8: 3 } });
    login({ username: 'Luna' });
    expect(changed).toHaveBeenCalledOnce();
    expect(p.stars(8)).toBe(3);
    expect(JSON.parse(store[KEY]).unlocked).toBeGreaterThanOrEqual(9);
  });

  it('a logout does not merge', async () => {
    let login: (u: CrazyUser | null) => void = () => {};
    const sdk: CrazySdk = { init: ok, environment: 'crazygames', data: { getItem: () => null, setItem: () => {} }, user: { getUser: () => Promise.resolve({ username: 'Luna' }), addAuthListener: (l) => { login = l; } } };
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    const p = new StoryProgress();
    const spy = vi.spyOn(p, 'mergeAccount');
    watchAccountMerge(p, () => {});
    await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
    spy.mockClear();
    login(null);
    expect(spy).not.toHaveBeenCalled();
  });
});
