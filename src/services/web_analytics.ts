// Cloudflare Web Analytics (page views; no cookies). Loaded only when the build
// has VITE_CF_BEACON_TOKEN (set in Vercel, see docs/ANALYTICS.md).

export function installWebAnalytics(): void {
  const token = import.meta.env?.VITE_CF_BEACON_TOKEN as string | undefined;
  if (!token || typeof document === 'undefined') return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token });
  document.head.appendChild(s);
}
