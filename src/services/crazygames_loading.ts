import { crazySdk, onCrazyReady } from './crazygames';

// CrazyGames loading events: `SDK.game.loadingStart()` when the SDK is ready while the game is still
// loading, `loadingStop()` once the first tappable screen is up. Each once, start before stop. If loading
// finished before the SDK was ready, neither is sent. Silent no-op without the SDK (our own site).

let loading = true;
let started = false;
let stopped = false;

function send(which: 'loadingStart' | 'loadingStop'): void {
  try { crazySdk()?.game?.[which]?.(); } catch (err) { console.warn(`CrazyGames SDK: ${which} failed`, err); }
}

/** Registers for the SDK-ready moment (call once at start-up). */
export function watchLoading(): void {
  onCrazyReady(() => {
    if (!loading || started) return;
    started = true;
    send('loadingStart');
  });
}

/** The first tappable screen (splash / quick start) is up: loading is over. */
export function loadingDone(): void {
  if (!loading) return;
  loading = false;
  if (started && !stopped) {
    stopped = true;
    send('loadingStop');
  }
}

/** Forget everything (tests). */
export function resetLoading(): void {
  loading = true;
  started = false;
  stopped = false;
}
