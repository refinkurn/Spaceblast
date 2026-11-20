import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from './crazygames';
import { adsAvailable, afterMidgameAd, midgameAd, onAdState, rewardedAd } from './crazygames_ads';

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

describe('rewardedAd', () => {
  it('finished: true, with the mute hook on at start and off at the end', async () => {
    const { sdk, asked } = await ready();
    const hook = vi.fn();
    onAdState(hook);
    const p = rewardedAd({ enabled: true });
    expect(sdk.ad!.requestAd).toHaveBeenCalledWith('rewarded', expect.any(Object));
    asked[0].adStarted!();
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenLastCalledWith(true);
    asked[0].adFinished!();
    await expect(p).resolves.toBe(true);
    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook).toHaveBeenLastCalledWith(false);
  });

  it('error: false, and the hook is released if the ad had started', async () => {
    const { asked } = await ready();
    const hook = vi.fn();
    onAdState(hook);
    const p = rewardedAd({ enabled: true });
    asked[0].adStarted!();
    asked[0].adError!(new Error('x'));
    await expect(p).resolves.toBe(false);
    expect(hook.mock.calls).toEqual([[true], [false]]);
  });

  it('error before start: false, hook untouched', async () => {
    const { asked } = await ready();
    const hook = vi.fn();
    onAdState(hook);
    const p = rewardedAd({ enabled: true });
    asked[0].adError!(new Error('x'));
    await expect(p).resolves.toBe(false);
    expect(hook).not.toHaveBeenCalled();
  });

  it('times out after 5 s without adStarted or adError: false', async () => {
    vi.useFakeTimers();
    await ready();
    const p = rewardedAd({ enabled: true });
    vi.advanceTimersByTime(5000);
    await expect(p).resolves.toBe(false);
  });

  it('switch off: false at once, never touches the SDK', async () => {
    const { sdk } = await ready();
    await expect(rewardedAd({ enabled: false })).resolves.toBe(false);
    expect(sdk.ad!.requestAd).not.toHaveBeenCalled();
  });

  it('ad blocker or no SDK: false at once', async () => {
    const { sdk } = await ready(true);
    await expect(rewardedAd({ enabled: true })).resolves.toBe(false);
    expect(sdk.ad!.requestAd).not.toHaveBeenCalled();
    resetCrazySdk();
    await expect(rewardedAd({ enabled: true })).resolves.toBe(false);
  });

  it('requestAd throwing: false, never rejects', async () => {
    const { sdk } = await ready();
    sdk.ad!.requestAd = () => { throw new Error('boom'); };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(rewardedAd({ enabled: true })).resolves.toBe(false);
  });
});
