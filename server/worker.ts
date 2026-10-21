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
      server.addEventListener('message', (e) => {
        this.room.message(slot, typeof e.data === 'string' ? e.data : '');
        this.clock();
      });
      server.addEventListener('close', (e) => {
        this.room.closed(slot, peer, e.code);
        this.clock();
      });
      server.addEventListener('error', () => this.room.closed(slot, peer, 1006));
    }
    this.clock();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Runs the room clock while it is needed, and stops it after. */
  private clock(): void {
    if (this.timer || !this.room.busy) return;
    this.timer = setInterval(() => {
      this.room.pump();
      if (!this.room.busy && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 16);
  }
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
      text = await request.text();
      if (new TextEncoder().encode(text).length > MAX_BODY) return json(400, { ok: false, reason: 'bad_body' });
    }
    const r = scoresApi(this.lb, request.method, new URL(request.url), text, Date.now());
    return json(r.status, r.body);
  }
}
