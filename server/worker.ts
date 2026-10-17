import { isRoomCode } from '../src/net/protocol';
import { Room, wishFromUrl } from './room';

// Cloudflare Worker: serves the game (the dist/ folder, via static assets) and
// runs one Durable Object per room code at /room/CODE. Free tier is plenty for
// testing with friends. Deploy with `npm run deploy` (see ONLINE.md).

interface Env {
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/\/room\/([A-Z]+)$/);
    if (!match) return env.ASSETS.fetch(request);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!isRoomCode(match[1])) return new Response('Bad room code', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
  },
};

/** One room. Lives in memory while anyone is connected. */
export class RoomObject implements DurableObject {
  private room = new Room();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const create = url.searchParams.has('create');
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const slot = this.room.join({ send: (d) => server.send(d), close: (c, r) => server.close(c, r) }, create, wishFromUrl(url));
    if (slot !== null) {
      server.addEventListener('message', (e) => this.room.message(slot, typeof e.data === 'string' ? e.data : ''));
      const leave = () => this.room.leave(slot);
      server.addEventListener('close', leave);
      server.addEventListener('error', leave);
    }
    return new Response(null, { status: 101, webSocket: client });
  }
}
