import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { SqlLike } from './leaderboard';

// SqlLike (the slice of Cloudflare's SqlStorage that SqlStore uses) over
// Node's built-in SQLite, no dependency: the leaderboard's storage on Fly.io
// (server/fly.ts, a file on the volume) and in the tests (':memory:').

export interface NodeSql extends SqlLike {
  close(): void;
}

/** Opens (or creates) the database file at `path`; ':memory:' for a throwaway one. */
export function openSqlite(path: string): NodeSql {
  const db = new DatabaseSync(path);
  // WAL: readers never wait for the writer; NORMAL: safe with WAL, far fewer fsyncs.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  // SqlStore runs a dozen fixed queries: prepare each once.
  const prepared = new Map<string, StatementSync>();
  return {
    exec(query, ...bindings) {
      let st = prepared.get(query);
      if (!st) {
        st = db.prepare(query);
        prepared.set(query, st);
      }
      const rows = st.all(...bindings) as Record<string, unknown>[]; // runs now, like Cloudflare's exec
      return { toArray: () => rows };
    },
    close() {
      prepared.clear();
      db.close();
    },
  };
}
