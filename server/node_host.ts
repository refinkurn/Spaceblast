import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { CLOSE_RETRY, isRoomCode } from '../src/net/protocol';
import { CORS_HEADERS, JSON_HEADERS, MAX_BODY, scoresApi, type Leaderboard } from './leaderboard';
import { Room, requestFromUrl, type Peer } from './room';

// Rooms and the scores API on plain Node (http + ws), shared by the dev relay
// (server/dev_relay.ts, inside Vite) and the standalone server on Fly.io
// (server/fly.ts). The Cloudflare Worker (server/worker.ts) hosts the same
// Room and Leaderboard its own way.

export interface NodeHostOptions {
  leaderboard: Leaderboard;
  /** The sender's network address; it only feeds the leaderboard's hashed rate limit. */
  clientAddress?: (req: IncomingMessage) => string | undefined;
  /** Put on every new Room for the stats overlay (e.g. "SIN"); '' shows nothing. */
  where?: string;
}

export interface NodeHost {
  /** Handles a WebSocket upgrade to /room/CODE. False (socket untouched) when the path isn't a room. */
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean;
  /** Handles /api/scores. False when the path is something else. */
  scores(req: IncomingMessage, res: ServerResponse): boolean;
  /** Rooms open right now. */
  readonly rooms: number;
  /**
   * Shutdown: stops the clock, refuses new rooms and closes every room socket
   * with `code`. Resolves once they have all closed (stragglers are cut off after `graceMs`).
   */
  close(code?: number, reason?: string, graceMs?: number): Promise<void>;
}

/** The address of the TCP peer (dev: the phone or browser itself). */
export const socketAddress = (req: IncomingMessage): string | undefined => req.socket.remoteAddress;

/** Behind Fly's proxy the TCP peer is the proxy; Fly puts the real sender in Fly-Client-IP. */
export function flyClientAddress(req: IncomingMessage): string | undefined {
  const h = req.headers['fly-client-ip'];
  return typeof h === 'string' && h ? h : socketAddress(req);
}

/** Biggest WebSocket message accepted; rooms ignore anything over 2,048 characters anyway. */
const MAX_PAYLOAD = 16 * 1024;
const ROOM_PATH = /\/room\/([A-Z]+)$/;

/** The request URL, or null when it doesn't parse (never throws). */
function urlOf(req: IncomingMessage): URL | null {
  try {
    return new URL(req.url ?? '/', 'http://localhost');
  } catch {
    return null;
  }
}

export function createNodeHost(opts: NodeHostOptions): NodeHost {
  const { leaderboard: lb, clientAddress = socketAddress, where = '' } = opts;
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  let closed = false;

  function join(ws: WebSocket, code: string, url: URL): void {
    ws.on('error', () => { /* 'close' follows */ });
    if (closed) {
      ws.close(CLOSE_RETRY, 'restart');
      return;
    }
    if (!isRoomCode(code)) {
      ws.send(JSON.stringify({ t: 'error', reason: 'bad_code' }));
      ws.close();
      return;
    }
    let room = rooms.get(code);
    if (!room) {
      room = new Room();
      room.where = where;
      rooms.set(code, room);
    }
    const peer: Peer = { send: (d) => ws.send(d), close: (c, r) => ws.close(c, r) };
    const slot = room.connect(peer, requestFromUrl(url));
    if (slot === null) {
      if (room.empty) rooms.delete(code);
      return;
    }
    const r = room;
    ws.on('message', (data) => r.message(slot, data.toString()));
    ws.on('close', (closeCode) => {
      if (closed) return;
      r.closed(slot, peer, closeCode);
      if (r.empty && rooms.get(code) === r) rooms.delete(code);
    });
  }

  function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const url = urlOf(req);
    const match = url?.pathname.match(ROOM_PATH);
    if (!url || !match) return false; // not ours (e.g. Vite's hot reload socket)
    if (closed) {
      socket.destroy();
      return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => join(ws, match[1], url));
    return true;
  }

  function scores(req: IncomingMessage, res: ServerResponse): boolean {
    const url = urlOf(req);
    if (url?.pathname !== '/api/scores') return false;
    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS).end();
      return true;
    }
    const send = (status: number, body: unknown, close = false) => {
      if (res.headersSent) return;
      res.writeHead(status, close ? { ...JSON_HEADERS, Connection: 'close' } : JSON_HEADERS).end(JSON.stringify(body));
    };
    const answer = (text: string) => {
      try {
        const r = scoresApi(lb, method, url, text, Date.now(), clientAddress(req));
        send(r.status, r.body);
      } catch (e) {
        console.error('scores:', e);
        send(500, { ok: false, reason: 'server' });
      }
    };
    if (method !== 'POST') {
      answer('');
      return true;
    }
    // Too big: answer at once and drop the connection, so the rest is never read.
    const tooBig = () => {
      req.removeAllListeners('data');
      req.pause();
      send(400, { ok: false, reason: 'bad_body' }, true);
    };
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) {
      tooBig();
      return true;
    }
    const parts: Buffer[] = [];
    let size = 0;
    req.on('error', () => { /* client went away */ });
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) tooBig();
      else parts.push(chunk);
    });
    req.on('end', () => {
      if (size <= MAX_BODY) answer(Buffer.concat(parts).toString('utf8'));
    });
    return true;
  }

  // One clock for all rooms: sends due ticks and expires dropped seats.
  const pump = setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.busy) room.pump();
      if (room.empty) rooms.delete(code);
    }
  }, 16);
  pump.unref();

  function close(code = CLOSE_RETRY, reason = 'restart', graceMs = 1000): Promise<void> {
    closed = true;
    clearInterval(pump);
    rooms.clear();
    const open = [...wss.clients];
    for (const ws of open) ws.close(code, reason);
    return new Promise((resolve) => {
      let left = open.length;
      const done = () => {
        clearTimeout(timer);
        wss.close();
        resolve();
      };
      const timer = setTimeout(() => {
        for (const ws of wss.clients) ws.terminate();
        done();
      }, graceMs);
      if (left === 0) return done();
      for (const ws of open) ws.once('close', () => { if (--left === 0) done(); });
    });
  }

  return { upgrade, scores, close, get rooms() { return rooms.size; } };
}

const text = (res: ServerResponse, status: number, body: string) =>
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(body);

/**
 * A plain HTTP server over a host (Fly): GET /healthz, /api/scores and
 * /room/CODE; anything else is 404 (the game page itself is hosted elsewhere).
 */
export function standaloneServer(host: NodeHost): Server {
  const server = createServer((req, res) => {
    const path = urlOf(req)?.pathname;
    if (path === '/healthz' && (req.method === 'GET' || req.method === 'HEAD')) return text(res, 200, 'ok');
    if (host.scores(req, res)) return;
    if (path && ROOM_PATH.test(path)) return text(res, 426, 'Expected a WebSocket');
    text(res, 404, 'Not found');
  });
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (host.upgrade(req, socket, head)) return;
    socket.on('error', () => socket.destroy());
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return server;
}
