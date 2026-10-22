import { isRoomCode } from '../src/net/protocol';
import { CORS_HEADERS, JSON_HEADERS, Leaderboard, MAX_BODY, SqlStore, scoresApi } from './leaderboard';
import { Room, requestFromUrl, type Peer } from './room';

// Cloudflare Worker: serves the game (the dist/ folder, via static assets) and
// runs one Durable Object per room code at /room/CODE. Free tier is plenty for
// testing with friends. Deploy with `npm run deploy` (see ONLINE.md).
// The leaderboard (/api/scores) is one more Durable Object, 'global'.

interface Env {
  ROOMS: DurableObjectNamespace;
  LEADERBOARD: DurableObjectNamespace;
  ASSETS: Fetcher;
}

/**
 * Where new rooms are created. Without a hint Cloudflare picks a data centre
 * near the room's creator, which from Indonesia measured ~90 ms away;
 * Asia-Pacific keeps rooms close to players in the region. (A hint only
 * applies when a room is first created.)
 */
const ROOM_REGION: DurableObjectLocationHint = 'apac';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/scores') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
      return env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global'), { locationHint: ROOM_REGION }).fetch(request);
    }
    const match = url.pathname.match(/\/room\/([A-Z]+)$/);
    if (!match) return env.ASSETS.fetch(request);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!isRoomCode(match[1])) return new Response('Bad room code', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(match[1]), { locationHint: ROOM_REGION }).fetch(request);
  },
};

/** The data centre this code runs in (e.g. "SIN"), from Cloudflare's trace page; '' if unknown. */
async function dataCentre(): Promise<string> {
  try {
    const text = await (await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(500) })).text();
    return text.match(/^colo=(\w+)$/m)?.[1] ?? '';
  } catch {
    return '';
  }
}

/** One room. Lives in memory while anyone is connected; its clock runs only during rounds. */
export class RoomObject implements DurableObject {
  private room = new Room();
  private timer: ReturnType<typeof setInterval> | null = null;
  private located: Promise<void> | null = null;

  async fetch(request: Request): Promise<Response> {
    // Once per room: learn where it runs, for the players' stats overlay (only
    // the first join waits for it: usually a few ms, 0.5 s at most).
    this.located ??= dataCentre().then((where) => { this.room.where = where; });
    await this.located;
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const peer: Peer = { send: (d) => server.send(d), close: (c, r) => server.close(c, r) };
    const slot = this.room.connect(peer, requestFromUrl(new URL(request.url)));
    if (slot !== null) {
      // A bug in one handler must never break the room for everyone: log it and carry on.
      const guard = (what: string, fn: () => void) => {
        try { fn(); } catch (e) { console.error(`room ${what}:`, e); }
        this.clock();
      };
      server.addEventListener('message', (e) => guard('message', () => this.room.message(slot, typeof e.data === 'string' ? e.data : '')));
      server.addEventListener('close', (e) => guard('close', () => this.room.closed(slot, peer, e.code)));
      // Counted as a drop (seat kept); if the deliberate close still follows, Room.closed frees the seat.
      server.addEventListener('error', () => guard('error', () => this.room.closed(slot, peer, 1006)));
    }
    this.clock();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Runs the room clock while it is needed, and stops it after. */
  private clock(): void {
    if (this.timer || !this.room.busy) return;
    this.timer = setInterval(() => {
      try { this.room.pump(); } catch (e) { console.error('room pump:', e); }
      if (!this.room.busy && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 16);
  }
}

/**
 * Reads a request body, but stops (null) as soon as it passes `max` bytes, so a
 * huge body without a Content-Length is never read in full.
 */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

/** The leaderboard: every stage's scores in one SQLite-backed object. */
export class LeaderboardObject implements DurableObject {
  private lb: Leaderboard;

  constructor(ctx: DurableObjectState) {
    this.lb = new Leaderboard(new SqlStore(ctx.storage.sql));
  }

  async fetch(request: Request): Promise<Response> {
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
    let text = '';
    if (request.method === 'POST') {
      if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return json(400, { ok: false, reason: 'bad_body' });
      const body = await readCapped(request, MAX_BODY);
      if (body === null) return json(400, { ok: false, reason: 'bad_body' });
      text = body;
    }
    // Cloudflare puts the sender's address here; it only feeds a hashed rate limit.
    const client = request.headers.get('CF-Connecting-IP') ?? undefined;
    const r = scoresApi(this.lb, request.method, new URL(request.url), text, Date.now(), client);
    return json(r.status, r.body);
  }
}
