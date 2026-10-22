import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { cacheVersion, serviceWorkerSource } from './offline_cache';

const SCOPE = 'https://game.example/play/';

/** Runs sw.js against fake caches and a fake network; `online` switches the network. */
function worker(files: string[], version = 'v1', opts: { quickTimeout?: boolean } = {}) {
  const stores = new Map<string, Map<string, string>>([['spaceblast-old', new Map()], ['other-app', new Map()]]);
  const listeners: Record<string, (e: unknown) => void> = {};
  const net = { online: true, hang: false, status: 200, fetched: [] as string[] };
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return { addAll: async (reqs: Array<{ url: string; cache: string }>) => {
        for (const r of reqs) { expect(r.cache).toBe('reload'); store.set(r.url, `saved ${r.url}`); }
      } };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: string | { url: string }) => {
      const url = (typeof req === 'string' ? req : req.url).split('?')[0];
      for (const s of stores.values()) if (s.has(url)) return s.get(url);
      return undefined;
    },
  };
  const fetch = async (req: { url: string }) => {
    net.fetched.push(req.url);
    if (net.hang) return new Promise(() => {});
    if (!net.online) throw new TypeError('offline');
    return { ok: net.status < 400, toString: () => `net ${net.status} ${req.url}` };
  };
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  class Request { constructor(readonly url: string, readonly init: { cache: string }) {} get cache() { return this.init.cache; } }
  const wait = opts.quickTimeout ? (fn: () => void) => setTimeout(fn, 1) : setTimeout;
  runInNewContext(serviceWorkerSource(version, files), { self, caches, fetch, URL, Request, Response: { error: () => 'error' }, setTimeout: wait, clearTimeout, Promise });
  const lifecycle = async (type: string) => {
    let wait: Promise<unknown> = Promise.resolve();
    listeners[type]({ waitUntil: (p: Promise<unknown>) => { wait = p; } });
    await wait;
  };
  /** What the worker answers for a request, or 'pass' when it leaves it to the browser. */
  const request = async (url: string, opts: { mode?: string; method?: string } = {}) => {
    let answer: Promise<unknown> | null = null;
    listeners.fetch({ request: { url, method: opts.method ?? 'GET', mode: opts.mode ?? 'cors' }, respondWith: (p: Promise<unknown>) => { answer = p; } });
    return answer ? String(await answer) : 'pass';
  };
  return { stores, net, lifecycle, request };
}

describe('offline cache (sw.js)', () => {
  it('saves the page and every file on install, and drops only its own old caches', async () => {
    const w = worker(['assets/index-abc.js', 'icon-192.png']);
    await w.lifecycle('install');
    expect([...w.stores.get('spaceblast-v1')!.keys()]).toEqual([SCOPE, `${SCOPE}assets/index-abc.js`, `${SCOPE}icon-192.png`]);
    await w.lifecycle('activate');
    expect([...w.stores.keys()].sort()).toEqual(['other-app', 'spaceblast-v1']);
  });

  it('opens the game with no connection: saved page for any page URL, saved files', async () => {
    const w = worker(['assets/index-abc.js']);
    await w.lifecycle('install');
    w.net.online = false;
    expect(await w.request(`${SCOPE}?room=ABCD`, { mode: 'navigate' })).toBe(`saved ${SCOPE}`);
    expect(await w.request(`${SCOPE}assets/index-abc.js`)).toBe(`saved ${SCOPE}assets/index-abc.js`);
  });

  it('online, the page comes from the network (updates arrive) and saved files skip it', async () => {
    const w = worker(['assets/index-abc.js']);
    await w.lifecycle('install');
    expect(await w.request(SCOPE, { mode: 'navigate' })).toBe(`net 200 ${SCOPE}`);
    expect(await w.request(`${SCOPE}assets/index-abc.js`)).toBe(`saved ${SCOPE}assets/index-abc.js`);
    expect(await w.request(`${SCOPE}assets/index-new.js`)).toBe(`net 200 ${SCOPE}assets/index-new.js`);
  });

  it('a host error or a stalled network falls back to the saved page; nothing saved gives an error', async () => {
    const w = worker([], 'v1', { quickTimeout: true });
    await w.lifecycle('install');
    w.net.status = 503;
    expect(await w.request(SCOPE, { mode: 'navigate' })).toBe(`saved ${SCOPE}`);
    w.net.hang = true;
    expect(await w.request(SCOPE, { mode: 'navigate' })).toBe(`saved ${SCOPE}`);
    const fresh = worker([]);
    fresh.net.online = false;
    expect(await fresh.request(SCOPE, { mode: 'navigate' })).toBe('error');
  });

  it('never answers rooms, the leaderboard, other sites or non-GET requests', async () => {
    const w = worker([]);
    await w.lifecycle('install');
    expect(await w.request(`${SCOPE}api/scores?stage=stage_1_1`)).toBe('pass');
    expect(await w.request(`${SCOPE}room/ABCD`)).toBe('pass');
    expect(await w.request('https://other.example/x.js')).toBe('pass');
    expect(await w.request(`${SCOPE}api/scores`, { method: 'POST' })).toBe('pass');
  });

  it('gets a new version when any file name or content changes', () => {
    const a = cacheVersion([['index.html', 'x'], ['assets/a.js', 'y']]);
    expect(cacheVersion([['assets/a.js', 'y'], ['index.html', 'x']])).toBe(a);
    expect(cacheVersion([['index.html', 'x2'], ['assets/a.js', 'y']])).not.toBe(a);
    expect(cacheVersion([['index.html', 'x'], ['assets/b.js', 'y']])).not.toBe(a);
  });
});
