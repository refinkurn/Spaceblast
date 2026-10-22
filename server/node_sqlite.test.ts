import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Leaderboard, SqlStore } from './leaderboard';
import { openSqlite } from './node_sqlite';

// The Fly server's leaderboard file: rows must survive a restart.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sub = (n: number, score: number) => ({
  device_uuid: uuid(n), display_name: `P${n}`, stage_id: 'stage_1_1', score, completion_time_seconds: 60, hearts_left: 3, stars: 3,
});

describe('node:sqlite storage', () => {
  const dirs: string[] = [];
  const tempDb = () => {
    const dir = mkdtempSync(join(tmpdir(), 'spaceblast-db-'));
    dirs.push(dir);
    return join(dir, 'leaderboard.db');
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('keeps scores and rate limits after close and reopen', () => {
    const path = tempDb();
    const first = openSqlite(path);
    const lb = new Leaderboard(new SqlStore(first), false);
    expect(lb.submit(sub(1, 5000), 0)).toMatchObject({ ok: true, rank: 1 });
    expect(lb.submit(sub(2, 7000), 0)).toMatchObject({ ok: true, rank: 1 });
    first.close();

    const again = openSqlite(path);
    const store = new SqlStore(again); // CREATE TABLE IF NOT EXISTS leaves the rows alone
    expect(store.top('stage_1_1', 10).map((r) => [r.name, r.score])).toEqual([['P2', 7000], ['P1', 5000]]);
    expect(store.limit(uuid(1))).toMatchObject({ last: 0, count: 1 });
    // The rate limit came back too: a post right away is still too fast.
    expect(new Leaderboard(store, false).submit(sub(1, 9000), 1000)).toEqual({ ok: false, reason: 'too_fast' });
    again.close();
  });

  it('opens files in WAL mode with synchronous NORMAL', () => {
    const db = openSqlite(tempDb());
    expect(db.exec('PRAGMA journal_mode').toArray()).toEqual([{ journal_mode: 'wal' }]);
    expect(db.exec('PRAGMA synchronous').toArray()).toEqual([{ synchronous: 1 }]); // 1 = NORMAL
    db.close();
  });

  it('reuses a prepared query with new bindings', () => {
    const db = openSqlite(':memory:');
    db.exec('CREATE TABLE t (k TEXT, v INT)');
    for (const [k, v] of [['a', 1], ['b', 2]] as const) db.exec('INSERT INTO t (k, v) VALUES (?, ?)', k, v);
    expect(db.exec('SELECT v FROM t WHERE k = ?', 'b').toArray()).toEqual([{ v: 2 }]);
    expect(db.exec('SELECT v FROM t WHERE k = ?', 'a').toArray()).toEqual([{ v: 1 }]);
    db.close();
  });
});
