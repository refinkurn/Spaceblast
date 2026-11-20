// CrazyGames midgame ads (off unless CRAZY_ADS; docs/design/crazygames-sdk.md). The SDK comes from
// crazygames.ts through `crazySdk()`; every call is a silent no-op without it.
import { CRAZY_ADS } from '../config/portal';
import { crazySdk, type CrazySdk } from './crazygames';

export interface AdDeps {
  /** Off unless the CRAZY_ADS switch is on. */
  enabled?: boolean;
  /** How long to wait for the ad to start or fail before carrying on (default 5 s). */
  startTimeoutMs?: number;
}

/** `SDK.ad.hasAdblock()`, checked once after init; assumed blocked until known. */
let adblock = true;
/** Told when an ad starts (true) and ends (false): main.ts mutes sound and ignores taps meanwhile. */
let adHook: ((playing: boolean) => void) | null = null;


/** Forget the ad state (tests; crazygames.ts calls it from `resetCrazySdk`). */
export function resetCrazyAds(): void {
  adblock = true;
  adHook = null;
}

export function onAdState(hook: ((playing: boolean) => void) | null): void {
  adHook = hook;
}

export async function checkAdblock(found: CrazySdk): Promise<void> {
  try {
    adblock = (await found.ad?.hasAdblock?.()) !== false;
  } catch (err) {
    adblock = true;
    console.warn('CrazyGames SDK: hasAdblock failed', err);
  }
}

/** Ads are on, the SDK is ready and no ad blocker was found. */
export function adsAvailable(deps: AdDeps = {}): boolean {
  return (deps.enabled ?? CRAZY_ADS) && !!crazySdk()?.ad?.requestAd && !adblock;
}

/**
 * A midgame ad between rounds. Resolves when it is over, or at once when ads are off, the SDK is
 * not ready or the ad errors. Never rejects. If neither adStarted nor adError comes within 5 s it
 * resolves anyway, so a player is never stuck on a blank screen.
 */
export function midgameAd(deps: AdDeps = {}): Promise<void> {
  if (!(deps.enabled ?? CRAZY_ADS) || !crazySdk()?.ad?.requestAd) return Promise.resolve();
  const ad = crazySdk()!.ad!;
  return new Promise<void>((resolve) => {
    let playing = false;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (playing) adHook?.(false);
      resolve();
    };
    timer = setTimeout(finish, deps.startTimeoutMs ?? 5000);
    try {
      ad.requestAd!('midgame', {
        adStarted: () => {
          if (done) return;
          clearTimeout(timer); // it plays now: wait for the end
          if (!playing) { playing = true; adHook?.(true); }
        },
        adFinished: finish,
        adError: finish,
      });
    } catch (err) {
      console.warn('CrazyGames SDK: requestAd failed', err);
      finish();
    }
  });
}

/**
 * Runs `next` after a midgame ad. With ads off (or no SDK) it runs at once, in the same call,
 * so the game plays exactly as without ads.
 */
export function afterMidgameAd(next: () => void, deps: AdDeps = {}): void {
  if (!(deps.enabled ?? CRAZY_ADS) || !crazySdk()?.ad?.requestAd) { next(); return; }
  void midgameAd(deps).then(next);
}

/**
 * A rewarded ad (nothing calls it yet; the button waits on the score question in docs/HANDOFF.md).
 * Resolves true only when the ad finished. False at once when ads are off, the SDK is not ready or
 * an ad blocker was found; false on an ad error or when neither adStarted nor adError comes within
 * 5 s. Never rejects. Mutes sound and shields taps through `onAdState`, like the midgame ad.
 */
export function rewardedAd(deps: AdDeps = {}): Promise<boolean> {
  if (!adsAvailable(deps)) return Promise.resolve(false);
  const ad = crazySdk()!.ad!;
  return new Promise<boolean>((resolve) => {
    let playing = false;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (rewarded: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (playing) adHook?.(false);
      resolve(rewarded);
    };
    timer = setTimeout(() => finish(false), deps.startTimeoutMs ?? 5000);
    try {
      ad.requestAd!('rewarded', {
        adStarted: () => {
          if (done) return;
          clearTimeout(timer); // it plays now: wait for the end
          if (!playing) { playing = true; adHook?.(true); }
        },
        adFinished: () => finish(true),
        adError: () => finish(false),
      });
    } catch (err) {
      console.warn('CrazyGames SDK: requestAd failed', err);
      finish(false);
    }
  });
}
