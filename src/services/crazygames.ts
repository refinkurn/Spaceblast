// CrazyGames HTML5 SDK v3 wrapper (docs/design/crazygames-sdk.md). Portal build only:
// the only file that touches `window.CrazyGames`. The game plays exactly as without it
// when the script is blocked, slow or broken: every call is a silent no-op until init finished.
import { CRAZY_ADS, CRAZY_SDK } from '../config/portal';
import { isRoomCode } from '../net/protocol';

/** Empty on our own site, so the address is not in that build at all. */
export const SDK_URL = CRAZY_SDK ? 'https://sdk.crazygames.com/crazygames-sdk-v3.js' : '';

/** The part of `window.CrazyGames.SDK` we use. */
export interface CrazySdk {
  init(): Promise<void>;
  environment?: string;
  ad?: {
    requestAd?(type: 'midgame' | 'rewarded', callbacks: { adStarted?: () => void; adFinished?: () => void; adError?: (error: unknown) => void }): unknown;
    hasAdblock?(): Promise<boolean> | boolean;
  };
  game?: {
    gameplayStart?(): void;
    gameplayStop?(): void;
    showInviteButton?(params: Record<string, string>): unknown;
    hideInviteButton?(): void;
    getInviteParam?(key: string): string | null;
  };
}

export interface CrazyDeps {
  /** Off on our own site (default: the CRAZY_SDK switch). */
  enabled?: boolean;
  /** Loads the SDK script (default: a <script> tag). */
  load?: (url: string) => Promise<void>;
  /** Finds the SDK once loaded (default: window.CrazyGames.SDK). */
  find?: () => CrazySdk | undefined;
}

export interface AdDeps {
  /** Off unless the CRAZY_ADS switch is on. */
  enabled?: boolean;
  /** How long to wait for the ad to start or fail before carrying on (default 5 s). */
  startTimeoutMs?: number;
}

let sdk: CrazySdk | null = null;
let warned = false;
/** Whether a round is running right now, and what the SDK was last told. */
let wanted = false;
let told = false;

function warnOnce(what: string, err?: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`CrazyGames SDK: ${what}`, err ?? '');
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script blocked or failed to load'));
    document.head.appendChild(s);
  });
}

/** The ready SDK, or null until init finished (or when it failed, was blocked or is disabled). */
export function crazySdk(): CrazySdk | null {
  return sdk;
}

/** Forget everything (tests). */
export function resetCrazySdk(): void {
  sdk = null;
  warned = false;
  wanted = false;
  told = false;
  inviteShown = false;
  adblock = true;
  adHook = null;
}

/** Tells the SDK about gameplay when it differs from what it last heard. Never throws. */
function sendGameplay(): void {
  if (!sdk || wanted === told) return;
  told = wanted;
  try {
    if (wanted) sdk.game?.gameplayStart?.();
    else sdk.game?.gameplayStop?.();
  } catch (err) {
    warnOnce('gameplay call failed', err);
  }
}

/**
 * A round is running and not paused (main loop, every frame). Only a change reaches the SDK;
 * until init finished the state is only remembered and sent once when it is ready.
 */
export function setGameplay(active: boolean): void {
  wanted = active;
  sendGameplay();
}

/** The invite button shows only while it is on, so a repeated call changes nothing. */
let inviteShown = false;

/** Lobby open with a room code: CrazyGames shows its invite button for that room. */
export function showInvite(code: string): void {
  if (!sdk || !code) return;
  try {
    sdk.game?.showInviteButton?.({ roomId: code });
    inviteShown = true;
  } catch (err) {
    warnOnce('showInviteButton failed', err);
  }
}

/** Lobby closed or the round started. Only calls the SDK if the button was shown. */
export function hideInvite(): void {
  if (!sdk || !inviteShown) return;
  inviteShown = false;
  try {
    sdk.game?.hideInviteButton?.();
  } catch (err) {
    warnOnce('hideInviteButton failed', err);
  }
}

/** The room code this page was opened with from a CrazyGames invite, or null (none, malformed, no SDK). */
export function inviteRoom(): string | null {
  if (!sdk) return null;
  try {
    const raw = sdk.game?.getInviteParam?.('roomId');
    const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    return isRoomCode(code) ? code : null;
  } catch (err) {
    warnOnce('getInviteParam failed', err);
    return null;
  }
}

/**
 * Boot: load the script and run `SDK.init()` in the background. Never throws and never
 * waits for anything the start screen needs. Resolves when done (tests await it).
 */
export async function initCrazySdk(deps: CrazyDeps = {}): Promise<void> {
  if (!(deps.enabled ?? CRAZY_SDK)) return;
  try {
    await (deps.load ?? loadScript)(SDK_URL);
    const found = deps.find ? deps.find() : (window as unknown as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
    if (!found) { warnOnce('script loaded but window.CrazyGames.SDK is missing'); return; }
    await found.init();
    if (found.environment === 'disabled') return; // not on crazygames.com: stay a no-op
    sdk = found;
    sendGameplay(); // the state reached while init was running
    await checkAdblock(found);
  } catch (err) {
    sdk = null;
    warnOnce('load or init failed; the game plays without it', err);
  }
}

// --- Midgame ads (off unless CRAZY_ADS) ------------------------------------------------------

/** `SDK.ad.hasAdblock()`, checked once after init; assumed blocked until known. */
let adblock = true;
/** Told when an ad starts (true) and ends (false): main.ts mutes sound and ignores taps meanwhile. */
let adHook: ((playing: boolean) => void) | null = null;

export function onAdState(hook: ((playing: boolean) => void) | null): void {
  adHook = hook;
}

async function checkAdblock(found: CrazySdk): Promise<void> {
  try {
    adblock = (await found.ad?.hasAdblock?.()) !== false;
  } catch (err) {
    adblock = true;
    warnOnce('hasAdblock failed', err);
  }
}

/** Ads are on, the SDK is ready and no ad blocker was found. */
export function adsAvailable(deps: AdDeps = {}): boolean {
  return (deps.enabled ?? CRAZY_ADS) && !!sdk?.ad?.requestAd && !adblock;
}

/**
 * A midgame ad between rounds. Resolves when it is over, or at once when ads are off, the SDK is
 * not ready or the ad errors. Never rejects. If neither adStarted nor adError comes within 5 s it
 * resolves anyway, so a player is never stuck on a blank screen.
 */
export function midgameAd(deps: AdDeps = {}): Promise<void> {
  if (!(deps.enabled ?? CRAZY_ADS) || !sdk?.ad?.requestAd) return Promise.resolve();
  const ad = sdk.ad;
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
      warnOnce('requestAd failed', err);
      finish();
    }
  });
}

/**
 * Runs `next` after a midgame ad. With ads off (or no SDK) it runs at once, in the same call,
 * so the game plays exactly as without ads.
 */
export function afterMidgameAd(next: () => void, deps: AdDeps = {}): void {
  if (!(deps.enabled ?? CRAZY_ADS) || !sdk?.ad?.requestAd) { next(); return; }
  void midgameAd(deps).then(next);
}
