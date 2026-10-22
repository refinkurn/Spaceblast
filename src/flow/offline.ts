// Offline play: registers the service worker that the build writes (sw.js,
// server/offline_cache.ts). Production builds only, so `npm run dev` always
// serves fresh files. Nothing to do where service workers aren't available.

export function registerOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play is a bonus; the game runs without it */ });
  }, { once: true });
}
