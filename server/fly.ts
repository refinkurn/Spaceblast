import { CLOSE_RETRY } from '../src/net/protocol';
import { Leaderboard, MemoryStore, SqlStore } from './leaderboard';
import { createNodeHost, flyClientAddress, standaloneServer } from './node_host';
import { openSqlite } from './node_sqlite';

// Fly.io entry (one machine): rooms at /room/CODE and the leaderboard at
// /api/scores on a plain Node server, plus GET /healthz for Fly's checks.
// The game page stays on Cloudflare, built to point here (VITE_RELAY_URL,
// VITE_API_BASE). Built by `npm run build:server` into dist-server/fly.js.
// Env: PORT (default 8080), FLY_REGION (shown in the stats overlay) and
// DB_PATH (the SQLite file on the volume; unset = scores in memory only).

const port = Number(process.env.PORT) || 8080;
const where = (process.env.FLY_REGION ?? '').toUpperCase();
const dbPath = process.env.DB_PATH;

const sql = dbPath ? openSqlite(dbPath) : null;
if (!sql) console.log('DB_PATH is not set: scores are kept in memory and will not persist.');
const host = createNodeHost({
  leaderboard: new Leaderboard(sql ? new SqlStore(sql) : new MemoryStore()),
  clientAddress: flyClientAddress,
  where,
});
const server = standaloneServer(host);
server.listen(port, '0.0.0.0', () => {
  console.log(`spaceblast server on port ${port}, region ${where || '(none)'}, scores ${dbPath ? `in ${dbPath}` : 'in memory'}`);
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: closing ${host.rooms} room(s)`);
  server.close(); // no new connections
  // CLOSE_RETRY: the browsers treat it as a drop and keep trying to rejoin for
  // a while instead of giving up at once (rooms live in memory, so a rejoin
  // after the restart is told the seat expired).
  await host.close(CLOSE_RETRY, 'restart');
  server.closeAllConnections();
  sql?.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
