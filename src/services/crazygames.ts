// CrazyGames HTML5 SDK v3 wrapper (docs/design/crazygames-sdk.md). Portal build only:
// the only file that touches `window.CrazyGames`. The game plays exactly as without it
// when the script is blocked, slow or broken: every call is a silent no-op until init finished.
import { CRAZY_SDK } from '../config/portal';
import { isRoomCode } from '../net/protocol';

/** Empty on our own site, so the address is not in that build at all. */
export const SDK_URL = CRAZY_SDK ? 'https://sdk.crazygames.com/crazygames-sdk-v3.js' : '';

/** The part of `window.CrazyGames.SDK` we use. */
export interface CrazySdk {
  init(): Promise<void>;
  environment?: string;
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
  } catch (err) {
    sdk = null;
    warnOnce('load or init failed; the game plays without it', err);
  }
}
