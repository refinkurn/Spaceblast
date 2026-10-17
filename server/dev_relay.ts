import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { isRoomCode } from '../src/net/protocol';
import { Room, requestFromUrl, type Peer } from './room';

// The room server for `npm run dev` and `npm run preview`: rooms run inside the Vite
// server at ws://<host>/room/CODE, so phones on the same Wi-Fi can play too.
// Production uses server/worker.ts on Cloudflare instead; both share Room.

export function devRelay(): Plugin {
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ noServer: true });

  function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = url.pathname.match(/\/room\/([A-Z]+)$/);
    if (!match) return; // not ours (e.g. Vite's hot reload socket)
    const code = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!isRoomCode(code)) {
        ws.send(JSON.stringify({ t: 'error', reason: 'bad_code' }));
        ws.close();
        return;
      }
      const room = rooms.get(code) ?? new Room();
      rooms.set(code, room);
      const peer: Peer = { send: (d) => ws.send(d), close: (c, r) => ws.close(c, r) };
      const slot = room.connect(peer, requestFromUrl(url));
      if (slot === null) {
        if (room.empty) rooms.delete(code);
        return;
      }
      ws.on('message', (data) => room.message(slot, data.toString()));
      ws.on('close', (closeCode) => {
        room.closed(slot, peer, closeCode);
        if (room.empty) rooms.delete(code);
      });
    });
  }

  // One clock for all rooms: sends due ticks and expires dropped seats.
  setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.busy) room.pump();
      if (room.empty) rooms.delete(code);
    }
  }, 16).unref();

  return {
    name: 'spaceblast-dev-relay',
    configureServer(server) {
      server.httpServer?.on('upgrade', upgrade);
    },
    configurePreviewServer(server) {
      server.httpServer?.on('upgrade', upgrade);
    },
  };
}
