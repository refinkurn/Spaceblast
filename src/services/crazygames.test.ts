import { afterEach, describe, expect, it, vi } from 'vitest';
import { SDK_URL, crazySdk, initCrazySdk, resetCrazySdk, setGameplay, type CrazySdk } from './crazygames';

const ok = () => Promise.resolve();
afterEach(() => { resetCrazySdk(); vi.restoreAllMocks(); });

describe('initCrazySdk', () => {
  it('does nothing on our own site', async () => {
    const load = vi.fn(ok);
    await initCrazySdk({ enabled: false, load });
    expect(load).not.toHaveBeenCalled();
    expect(crazySdk()).toBeNull();
  });

  it('loads the v3 script (address only in the portal build) and keeps a working SDK', async () => {
    const fake: CrazySdk = { init: vi.fn(ok), environment: 'crazygames' };
    const load = vi.fn(ok);
    await initCrazySdk({ enabled: true, load, find: () => fake });
    expect(load).toHaveBeenCalledWith(SDK_URL);
    expect(fake.init).toHaveBeenCalledOnce();
    expect(crazySdk()).toBe(fake);
  });

  it('a missing SDK object leaves the game as it is, warned once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(initCrazySdk({ enabled: true, load: ok, find: () => undefined })).resolves.toBeUndefined();
    await initCrazySdk({ enabled: true, load: ok, find: () => undefined });
    expect(crazySdk()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a blocked script (ad blocker) does not throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(initCrazySdk({ enabled: true, load: () => Promise.reject(new Error('blocked')) })).resolves.toBeUndefined();
    expect(crazySdk()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a throwing or rejecting init does not throw', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwing: CrazySdk = { init: () => { throw new Error('boom'); } };
    await expect(initCrazySdk({ enabled: true, load: ok, find: () => throwing })).resolves.toBeUndefined();
    expect(crazySdk()).toBeNull();
    const rejecting: CrazySdk = { init: () => Promise.reject(new Error('no')) };
    await expect(initCrazySdk({ enabled: true, load: ok, find: () => rejecting })).resolves.toBeUndefined();
    expect(crazySdk()).toBeNull();
  });

  it('an SDK outside crazygames.com ("disabled") stays a no-op', async () => {
    await initCrazySdk({ enabled: true, load: ok, find: () => ({ init: ok, environment: 'disabled' }) });
    expect(crazySdk()).toBeNull();
  });
});

describe('setGameplay', () => {
  const fakeSdk = () => {
    const calls: string[] = [];
    const sdk: CrazySdk = { init: ok, environment: 'crazygames', game: { gameplayStart: () => { calls.push('start'); }, gameplayStop: () => { calls.push('stop'); } } };
    return { sdk, calls };
  };

  it('start, stop, start, stop for level start, pause, resume, clear; nothing on repeated frames', async () => {
    const { sdk, calls } = fakeSdk();
    await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
    setGameplay(false); setGameplay(false); // menu frames
    setGameplay(true); setGameplay(true); setGameplay(true); // level runs
    setGameplay(false); setGameplay(false); // pause
    setGameplay(true); // resume
    setGameplay(false); setGameplay(false); // level clear
    expect(calls).toEqual(['start', 'stop', 'start', 'stop']);
  });

  it('a state reached before init finished is sent once when it is ready', async () => {
    const { sdk, calls } = fakeSdk();
    setGameplay(true);
    expect(calls).toEqual([]);
    await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
    expect(calls).toEqual(['start']);
    setGameplay(true);
    expect(calls).toEqual(['start']);
  });

  it('makes no SDK call on our own site, with the SDK blocked, or when a call throws', async () => {
    const { sdk, calls } = fakeSdk();
    await initCrazySdk({ enabled: false, load: ok, find: () => sdk });
    setGameplay(true); setGameplay(false);
    expect(calls).toEqual([]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad: CrazySdk = { init: ok, game: { gameplayStart: () => { throw new Error('x'); } } };
    await initCrazySdk({ enabled: true, load: ok, find: () => bad });
    expect(() => setGameplay(true)).not.toThrow();
  });
});
