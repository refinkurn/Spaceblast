import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from './crazygames';
import { adsAvailable, afterMidgameAd, midgameAd, onAdState } from './crazygames_ads';

type Cb = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };
const ok = () => Promise.resolve();

/** A ready SDK whose requestAd hands its callbacks to the test. */
async function ready(adblock: boolean | Promise<boolean> = false) {
  const asked: Cb[] = [];
  const sdk: CrazySdk = { init: ok, environment: 'crazygames', ad: { requestAd: vi.fn((_t, cb: Cb) => { asked.push(cb); }), hasAdblock: () => adblock } };
  await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
  return { sdk, asked };
}

afterEach(() => { resetCrazySdk(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('midgameAd', () => {
  it('switch off: resolves at once and never touches the SDK', async () => {
    const { sdk } = await ready();
    await expect(midgameAd({ enabled: false })).resolves.toBeUndefined();
    expect(sdk.ad!.requestAd).not.toHaveBeenCalled();
  });

  it('the shipped switch is off, so the default call does nothing', async () => {
    const { sdk } = await ready();
    await midgameAd();
    expect(sdk.ad!.requestAd).not.toHaveBeenCalled();
    expect(adsAvailable()).toBe(false);
  });

  it('no SDK: resolves at once', async () => {
    await expect(midgameAd({ enabled: true })).resolves.toBeUndefined();
  });

  it('adError resolves it and nothing was muted', async () => {
    const { asked } = await ready();
    const hook = vi.fn();
    onAdState(hook);
    const p = midgameAd({ enabled: true });
    asked[0].adError!('no fill');
    await expect(p).resolves.toBeUndefined();
    expect(hook).not.toHaveBeenCalled();
  });

  it('resolves anyway when neither adStarted nor adError comes within 5 s', async () => {
    vi.useFakeTimers();
    await ready();
    let done = false;
    void midgameAd({ enabled: true }).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(4900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });

  it('adStarted mutes and shields, adFinished restores', async () => {
    vi.useFakeTimers();
    const { asked } = await ready();
    const states: boolean[] = [];
    onAdState((p) => states.push(p));
    let done = false;
    void midgameAd({ enabled: true }).then(() => { done = true; });
    asked[0].adStarted!();
    expect(states).toEqual([true]);
    await vi.advanceTimersByTimeAsync(60000); // a long ad is not cut by the 5 s limit
    expect(done).toBe(false);
    asked[0].adFinished!();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    expect(states).toEqual([true, false]);
  });

  it('an error after the ad started still restores sound, once', async () => {
    const { asked } = await ready();
    const states: boolean[] = [];
    onAdState((p) => states.push(p));
    const p = midgameAd({ enabled: true });
    asked[0].adStarted!();
    asked[0].adError!('x');
    asked[0].adFinished!();
    await p;
    expect(states).toEqual([true, false]);
  });

  it('a throwing requestAd resolves it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = await ready();
    sdk.ad!.requestAd = () => { throw new Error('boom'); };
    await expect(midgameAd({ enabled: true })).resolves.toBeUndefined();
  });
});

describe('adsAvailable', () => {
  it('needs the switch, a ready SDK and no ad blocker', async () => {
    expect(adsAvailable({ enabled: true })).toBe(false); // no SDK
    await ready(false);
    expect(adsAvailable({ enabled: true })).toBe(true);
    expect(adsAvailable({ enabled: false })).toBe(false);
  });

  it('an ad blocker turns it off', async () => {
    await ready(true);
    expect(adsAvailable({ enabled: true })).toBe(false);
  });
});

describe('afterMidgameAd', () => {
  it('switch off: runs the action in the same call', () => {
    const next = vi.fn();
    afterMidgameAd(next, { enabled: false });
    expect(next).toHaveBeenCalledOnce();
  });

  it('switch on: runs it only after the ad finished', async () => {
    const { asked } = await ready();
    const next = vi.fn();
    afterMidgameAd(next, { enabled: true });
    expect(next).not.toHaveBeenCalled();
    asked[0].adFinished!();
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledOnce();
  });
});
