import { afterEach, describe, expect, it, vi } from 'vitest';
import { SDK_URL, crazySdk, initCrazySdk, resetCrazySdk, type CrazySdk } from './crazygames';

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
