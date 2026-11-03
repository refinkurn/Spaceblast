// Offline play: registers the service worker that the build writes (sw.js,
// server/offline_cache.ts). Production builds only, so `npm run dev` always
// serves fresh files. Nothing to do where service workers aren't available.

const RELOAD_KEY = 'spaceblast-stale-reload';

/**
 * A tab left open across a deploy can ask for a code file the new build renamed.
 * Reload the page once to pick up the new version; never loop. Returns true when it reloaded.
 */
export function reloadOnceIfStale(
  store: Pick<Storage, 'getItem' | 'setItem'> | null,
  reload: () => void,
): boolean {
  if (!store) return false; // can't guard against a loop, so don't reload
  try {
    if (store.getItem(RELOAD_KEY)) return false;
    store.setItem(RELOAD_KEY, '1');
  } catch {
    return false;
  }
  reload();
  return true;
}

/** A clean start (the page loaded and ran for a while) re-arms the single reload. */
export function clearStaleReload(store: Pick<Storage, 'removeItem'> | null): void {
  try { store?.removeItem(RELOAD_KEY); } catch { /* ignore */ }
}

const session = (): Storage | null => {
  try { return window.sessionStorage; } catch { return null; }
};

export function registerOfflineCache(): void {
  if (!import.meta.env.PROD) return;
  // Vite fires this when a lazily loaded chunk fails (a deployed-away file).
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadOnceIfStale(session(), () => window.location.reload())) e.preventDefault();
  });
  window.setTimeout(() => clearStaleReload(session()), 10000);
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play is a bonus; the game runs without it */ });
  }, { once: true });
}
