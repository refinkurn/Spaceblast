import { afterEach, describe, expect, it } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from './crazygames';
import { loadingDone, resetLoading, watchLoading } from './crazygames_loading';

const ok = () => Promise.resolve();

function fake(calls: string[]): CrazySdk {
  return { init: ok, environment: 'crazygames', game: { loadingStart: () => { calls.push('start'); }, loadingStop: () => { calls.push('stop'); } } };
}
const boot = (sdk: CrazySdk) => initCrazySdk({ enabled: true, load: ok, find: () => sdk });

afterEach(() => { resetCrazySdk(); resetLoading(); });

describe('CrazyGames loading events', () => {
  it('SDK ready while loading: start, then stop once the first screen is up, each once', async () => {
    const calls: string[] = [];
    watchLoading();
    await boot(fake(calls));
    expect(calls).toEqual(['start']);
    loadingDone();
    loadingDone();
    expect(calls).toEqual(['start', 'stop']);
  });

  it('loading finished before the SDK was ready: neither is sent', async () => {
    const calls: string[] = [];
    watchLoading();
    loadingDone();
    await boot(fake(calls));
    expect(calls).toEqual([]);
  });

  it('no SDK (our own site): nothing happens and nothing throws', async () => {
    watchLoading();
    await initCrazySdk({ enabled: false });
    expect(() => loadingDone()).not.toThrow();
  });

  it('an SDK without the loading calls, or one that throws, is ignored', async () => {
    watchLoading();
    await boot({ init: ok, environment: 'crazygames', game: { loadingStart: () => { throw new Error('x'); } } });
    expect(() => loadingDone()).not.toThrow();
  });
});
