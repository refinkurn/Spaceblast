import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { Leaderboard, MemoryStore } from './leaderboard';
import { createNodeHost, socketAddress, type NodeHost } from './node_host';

// The room server for `npm run dev` and `npm run preview`: rooms run inside the Vite
// server at ws://<host>/room/CODE, so phones on the same Wi-Fi can play too.
// Production uses server/worker.ts on Cloudflare or server/fly.ts on Fly.io;
// all of them share Room (the Node hosting itself is server/node_host.ts).
// Also serves the leaderboard at /api/scores (in memory, gone on restart).

export function devRelay(): Plugin {
  // Made on first use, so loading the config (builds, tests) starts nothing.
  let host: NodeHost | null = null;
  const attach = (server: ViteDevServer | PreviewServer) => {
    host ??= createNodeHost({ leaderboard: new Leaderboard(new MemoryStore()), clientAddress: socketAddress, where: '' });
    const h = host;
    server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => { h.upgrade(req, socket, head); });
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (!h.scores(req, res)) next();
    });
  };
  return {
    name: 'spaceblast-dev-relay',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
