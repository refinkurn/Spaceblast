import { request, type IncomingHttpHeaders, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { CLOSE_RETRY } from '../src/net/protocol';
import { Leaderboard, MAX_BODY, MemoryStore, clientKey, type Store } from './leaderboard';
import { createNodeHost, flyClientAddress, socketAddress, standaloneServer, type NodeHost, type NodeHostOptions } from './node_host';

// The Node hosting (dev relay and Fly) over real sockets: routes, the scores
// API, room joins and shutdown.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// A real level 1 clear (see leaderboard.test.ts), so the score check stays on.
const clear = (o: Record<string, unknown> = {}) => JSON.stringify({
  device_uuid: uuid(1), display_name: 'Ana', stage_id: 'stage_1_1', score: 6800, completion_time_seconds: 60, hearts_left: 3, stars: 3, ...o,
});

interface Running { host: NodeHost; server: Server; port: number; store: Store }
const running: Running[] = [];

async function start(opts: Partial<NodeHostOptions> & { store?: Store } = {}): Promise<Running> {
  const store = opts.store ?? new MemoryStore();
  const host = createNodeHost({ leaderboard: new Leaderboard(store, true, 'salt'), ...opts });
  const server = standaloneServer(host);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const run = { host, server, port: (server.address() as AddressInfo).port, store };
  running.push(run);
  return run;
}

afterEach(async () => {
  for (const { host, server } of running.splice(0)) {
    if (!server.listening) { // the test shut it down itself
      await host.close();
      continue;
    }
    const closed = new Promise((r) => server.once('close', r));
    server.close();
    await host.close();
    server.closeAllConnections();
    await closed;
  }
  vi.restoreAllMocks();
});

interface Reply { status: number; headers: IncomingHttpHeaders; body: string }

/** One HTTP request on its own connection. `partial`: send this much body and wait for the answer without finishing. */
function call(port: number, method: string, path: string, o: { headers?: Record<string, string>; body?: string; partial?: string } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: o.headers, agent: false }, (res) => {
      const parts: Buffer[] = [];
      res.on('data', (c: Buffer) => parts.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts).toString('utf8') });
        if (o.partial !== undefined) req.destroy();
      });
    });
    req.on('error', reject);
    if (o.partial !== undefined) req.write(o.partial);
    else req.end(o.body);
  });
}

const json = { 'Content-Type': 'application/json' };

function firstMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    ws.once('message', (d) => resolve(JSON.parse(d.toString())));
    ws.once('error', reject);
  });
}
const closeCode = (ws: WebSocket) => new Promise<number>((r) => ws.once('close', (code) => r(code)));

describe('node host: HTTP routes', () => {
  it('answers /healthz with ok, a plain GET of a room with 426, anything else with 404', async () => {
    const { port } = await start();
    const health = await call(port, 'GET', '/healthz');
    expect(health).toMatchObject({ status: 200, body: 'ok' });
    expect(health.headers['content-type']).toMatch(/^text\/plain/);
    expect((await call(port, 'GET', '/room/ABCD')).status).toBe(426);
    expect((await call(port, 'GET', '/')).status).toBe(404);
    expect((await call(port, 'GET', '/index.html')).status).toBe(404);
  });

  it('answers OPTIONS /api/scores with 204 and CORS headers', async () => {
    const { port } = await start();
    const r = await call(port, 'OPTIONS', '/api/scores');
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('*');
    expect(r.headers['access-control-allow-methods']).toContain('POST');
  });

  it('round-trips a score: POST then GET', async () => {
    const { port } = await start();
    const post = await call(port, 'POST', '/api/scores', { headers: json, body: clear() });
    expect(post.status).toBe(200);
    expect(post.headers['access-control-allow-origin']).toBe('*');
    expect(JSON.parse(post.body)).toEqual({ ok: true, rank: 1, best: 6800, name: 'Ana' });
    const get = await call(port, 'GET', `/api/scores?stage=stage_1_1&device=${uuid(1)}`);
    const row = { rank: 1, display_name: 'Ana', score: 6800, completion_time_seconds: 60, stars: 3 };
    expect(get.status).toBe(200);
    expect(JSON.parse(get.body)).toEqual({ stage_id: 'stage_1_1', top: [row], you: row });
  });

  it('refuses an oversized POST with 400 before reading it all, and drops the connection', async () => {
    const { port, store } = await start();
    const big = 'x'.repeat(MAX_BODY + 500);
    // Announced as too big: answered without waiting for any of the body.
    const declared = await call(port, 'POST', '/api/scores', { headers: { ...json, 'Content-Length': '100000' }, partial: '' });
    // No length given (chunked): cut off once past MAX_BODY, while the sender is still sending.
    const chunked = await call(port, 'POST', '/api/scores', { headers: { ...json, 'Transfer-Encoding': 'chunked' }, partial: big });
    for (const r of [declared, chunked]) {
      expect(r.status).toBe(400);
      expect(JSON.parse(r.body)).toEqual({ ok: false, reason: 'bad_body' });
      expect(r.headers.connection).toBe('close');
    }
    expect(store.top('stage_1_1', 10)).toEqual([]);
    expect((await call(port, 'GET', '/healthz')).status).toBe(200);
  });

  it('answers 500 and keeps running when the store fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = new Proxy({}, { get: () => () => { throw new Error('disk full'); } }) as Store;
    const { port } = await start({ store: broken });
    const r = await call(port, 'POST', '/api/scores', { headers: json, body: clear() });
    expect(r.status).toBe(500);
    expect(JSON.parse(r.body)).toEqual({ ok: false, reason: 'server' });
    expect((await call(port, 'GET', '/healthz')).status).toBe(200);
  });
});

describe('node host: client address', () => {
  const fake = (headers: Record<string, string>, remoteAddress = '10.0.0.1') => ({ headers, socket: { remoteAddress } }) as unknown as IncomingMessage;

  it('the Fly reader takes Fly-Client-IP, else the socket; the dev reader ignores headers', () => {
    expect(flyClientAddress(fake({ 'fly-client-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(flyClientAddress(fake({}))).toBe('10.0.0.1');
    expect(socketAddress(fake({ 'fly-client-ip': '203.0.113.9' }))).toBe('10.0.0.1');
  });

  it('rate-limits by the address the reader gives', async () => {
    const headers = { ...json, 'Fly-Client-IP': '203.0.113.9' };
    const fly = await start({ clientAddress: flyClientAddress });
    expect((await call(fly.port, 'POST', '/api/scores', { headers, body: clear() })).status).toBe(200);
    expect(fly.store.limit(clientKey('203.0.113.9', 'salt'))?.count).toBe(1);
    expect(fly.store.limit(clientKey('127.0.0.1', 'salt'))).toBeNull();

    const dev = await start({ clientAddress: socketAddress });
    expect((await call(dev.port, 'POST', '/api/scores', { headers, body: clear() })).status).toBe(200);
    expect(dev.store.limit(clientKey('203.0.113.9', 'salt'))).toBeNull(); // a header anyone can send
    expect(dev.store.limit(clientKey('127.0.0.1', 'salt'))?.count).toBe(1);
  });
});

describe('node host: rooms', () => {
  it('welcomes a room creator with the host\'s `where`; leaving frees the room', async () => {
    const { host, port } = await start({ where: 'SIN' });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/room/ABCD?create=1&name=Bo`);
    const welcome = await firstMessage(ws);
    expect(welcome).toMatchObject({ t: 'welcome', you: 0, host: 0, where: 'SIN', players: [{ slot: 0, name: 'Bo' }] });
    expect(host.rooms).toBe(1);
    const closed = closeCode(ws);
    ws.close(1000); // CLOSE_LEAVE
    await closed;
    await vi.waitFor(() => expect(host.rooms).toBe(0));
  });

  it('sends no `where` when it is empty (dev)', async () => {
    const { port } = await start({ where: '' });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/room/ABCD?create=1&name=Bo`);
    const welcome = await firstMessage(ws);
    expect(welcome.t).toBe('welcome');
    expect(welcome).not.toHaveProperty('where');
    ws.close(1000);
  });

  it('refuses a bad code with an error message, and a non-room path with 404', async () => {
    const { host, port } = await start();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/room/ABIO`); // no I or O in codes
    const closed = closeCode(ws);
    expect(await firstMessage(ws)).toEqual({ t: 'error', reason: 'bad_code' });
    await closed;
    expect(host.rooms).toBe(0);
    const other = new WebSocket(`ws://127.0.0.1:${port}/elsewhere`);
    await expect(new Promise((_, reject) => other.once('error', reject))).rejects.toThrow(/404/);
  });
});

describe('node host: shutdown', () => {
  const sockets = () => process.getActiveResourcesInfo().filter((r) => r.startsWith('TCP')).length;

  it('closes every room socket with CLOSE_RETRY, stops the clock and leaves no open handles', async () => {
    const before = sockets();
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { host, server, port } = await start({ where: 'SIN' });
    const pump = setSpy.mock.results[setSpy.mock.calls.findIndex(([, ms]) => ms === 16)]?.value;
    expect(pump).toBeDefined();

    const a = new WebSocket(`ws://127.0.0.1:${port}/room/WXYZ?create=1&name=Ana`);
    await firstMessage(a);
    const b = new WebSocket(`ws://127.0.0.1:${port}/room/WXYZ?name=Bo`);
    await firstMessage(b);
    expect(host.rooms).toBe(1);
    const codes = Promise.all([closeCode(a), closeCode(b)]);

    // What server/fly.ts does on SIGTERM.
    const serverClosed = new Promise((r) => server.once('close', r));
    server.close();
    await host.close(CLOSE_RETRY, 'restart');
    server.closeAllConnections();
    await serverClosed;

    expect(await codes).toEqual([CLOSE_RETRY, CLOSE_RETRY]);
    expect(host.rooms).toBe(0);
    expect(clearSpy).toHaveBeenCalledWith(pump);
    await new Promise((r) => setImmediate(r));
    expect(sockets()).toBeLessThanOrEqual(before);
  });

  it('cuts off a socket that does not finish closing within the grace time', async () => {
    const { host, port } = await start();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/room/QRST?create=1`);
    await firstMessage(ws);
    // A peer that never answers the close frame (e.g. a phone that lost signal).
    const raw = (ws as unknown as { _socket: { pause(): void } })._socket;
    raw.pause();
    const t0 = Date.now();
    await host.close(CLOSE_RETRY, 'restart', 200);
    expect(Date.now() - t0).toBeLessThan(2000);
    ws.terminate();
  });
});
