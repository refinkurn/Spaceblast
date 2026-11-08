import { describe, expect, it } from 'vitest';
import { cleanVersion, type ServerMsg } from '../src/net/protocol';
import { Room, requestFromUrl, type JoinRequest } from './room';
import { sameBuild } from './room_join';
import { STRAGGLER_MS } from './round_clock';

// Room rules added after the first online release: one build per room, no
// restart mid-round, and a profile change without a name keeps the name.

function peer() {
  const got: ServerMsg[] = [];
  return { got, closed: 0, send(d: string) { got.push(JSON.parse(d)); }, close(code = 1000) { this.closed = code; } };
}
const msg = (m: object) => JSON.stringify(m);
const req = (r: Partial<JoinRequest> = {}): JoinRequest => ({ create: false, ...r });
const starts = (p: ReturnType<typeof peer>) => p.got.filter((m) => m.t === 'start');

describe('room: one build per room (version check on join)', () => {
  it('reads ?v from the join URL; a missing or malformed one is an old page ("")', () => {
    expect(requestFromUrl(new URL('ws://x/room/ABCD?create=1&v=abc123def456')).version).toBe('abc123def456');
    expect(cleanVersion(requestFromUrl(new URL('ws://x/room/ABCD?create=1')).version)).toBe('');
    for (const bad of [undefined, null, 7, '', 'a b', '<script>', 'x'.repeat(41)]) expect(cleanVersion(bad), String(bad)).toBe('');
    expect(cleanVersion('0.1.0-dev_2')).toBe('0.1.0-dev_2');
  });

  it('seats a later player with the same build', () => {
    const room = new Room();
    const a = peer(), b = peer();
    expect(room.connect(a, req({ create: true, version: 'aaa111' }))).toBe(0);
    expect(room.connect(b, req({ version: 'aaa111' }))).toBe(1);
    expect(b.got[0].t).toBe('welcome');
  });

  it('refuses a different build with "update", before seating it or telling anyone', () => {
    const room = new Room();
    const a = peer(), b = peer(), c = peer();
    room.connect(a, req({ create: true, version: 'aaa111' }));
    const before = a.got.length;
    expect(room.connect(b, req({ name: 'Bo', version: 'bbb222' }))).toBeNull();
    expect(b.got).toEqual([{ t: 'error', reason: 'update' }]);
    expect(b.closed).toBe(4000);
    expect(a.got.length).toBe(before); // no profile broadcast for a refused join
    // The seat stayed free for a matching player.
    expect(room.connect(c, req({ version: 'aaa111' }))).toBe(1);
  });

  it('an old page (no version) and a new page never share a room, either way round', () => {
    const oldRoom = new Room();
    oldRoom.connect(peer(), req({ create: true })); // old page: no ?v
    const fresh = peer();
    expect(oldRoom.connect(fresh, req({ version: 'aaa111' }))).toBeNull();
    expect(fresh.got.at(-1)).toEqual({ t: 'error', reason: 'update' });
    const old2 = peer();
    expect(oldRoom.connect(old2, req())).toBe(1); // two old pages still play together

    const newRoom = new Room();
    newRoom.connect(peer(), req({ create: true, version: 'aaa111' }));
    const old = peer();
    expect(newRoom.connect(old, req({ version: null }))).toBeNull();
    expect(old.got.at(-1)).toEqual({ t: 'error', reason: 'update' });
  });

  it('a rejoin from a page reloaded into another build is refused; the same build gets its seat back', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.connect(a, req({ create: true, version: 'aaa111' }), 0);
    room.connect(b, req({ version: 'aaa111' }), 0);
    const w = b.got[0];
    const token = w.t === 'welcome' ? w.token : '';
    room.closed(1, b, 1006, 100);
    const reloaded = peer();
    expect(room.connect(reloaded, req({ rejoin: 1, token, version: 'bbb222' }), 200)).toBeNull();
    expect(reloaded.got).toEqual([{ t: 'error', reason: 'update' }]);
    const back = peer();
    expect(room.connect(back, req({ rejoin: 1, token, version: 'aaa111' }), 300)).toBe(1);
  });

  it('a room that empties forgets its build: the next creator sets it', () => {
    const room = new Room();
    const a = peer();
    room.connect(a, req({ create: true, version: 'aaa111' }));
    room.closed(0, a, 1000);
    expect(room.empty).toBe(true);
    room.connect(peer(), req({ create: true, version: 'bbb222' }));
    expect(room.connect(peer(), req({ version: 'bbb222' }))).toBe(1);
  });

  it("'dev' matches any build only on the dev server; in production it is just another version", () => {
    expect(sameBuild('aaa111', 'dev', true)).toBe(true);
    expect(sameBuild('dev', 'aaa111', true)).toBe(true);
    expect(sameBuild('dev', '', true)).toBe(true);
    expect(sameBuild('aaa111', 'bbb222', true)).toBe(false);
    expect(sameBuild('aaa111', 'dev', false)).toBe(false);
    expect(sameBuild('dev', 'aaa111', false)).toBe(false);
    expect(sameBuild('dev', 'dev', false)).toBe(true);

    const devRoom = new Room({ devVersions: true });
    devRoom.connect(peer(), req({ create: true, version: 'aaa111' }));
    expect(devRoom.connect(peer(), req({ version: 'dev' }))).toBe(1);
    const prodRoom = new Room();
    prodRoom.connect(peer(), req({ create: true, version: 'aaa111' }));
    expect(prodRoom.connect(peer(), req({ version: 'dev' }))).toBeNull();
  });
});

describe('room: no restart mid-round', () => {
  function playing() {
    const room = new Room();
    const a = peer(), b = peer();
    room.connect(a, req({ create: true }), 0);
    room.connect(b, req(), 0);
    room.message(0, msg({ t: 'start', seed: 5 }), 0);
    return { room, a, b };
  }

  it("ignores the host's start while the round runs, and takes it once everyone has finished", () => {
    const { room, a, b } = playing();
    room.message(0, msg({ t: 'start', seed: 6 }), 1000);
    expect(starts(b)).toHaveLength(1);
    room.message(0, msg({ t: 'over', r: 1 }), 2000);
    room.message(0, msg({ t: 'start', seed: 6 }), 2100); // b is still playing
    expect(starts(b)).toHaveLength(1);
    room.message(1, msg({ t: 'over', r: 1 }), 2200);
    room.message(0, msg({ t: 'start', seed: 7 }), 2300);
    expect(starts(a).map((m) => m.t === 'start' && m.r)).toEqual([1, 2]);
  });

  it('a player who never says over (screen off) holds the next round back only STRAGGLER_MS', () => {
    const { room, b } = playing();
    room.message(0, msg({ t: 'over', r: 1 }), 5000);
    room.message(0, msg({ t: 'start', seed: 6 }), 5000 + STRAGGLER_MS - 1);
    expect(starts(b)).toHaveLength(1);
    room.message(0, msg({ t: 'start', seed: 6 }), 5000 + STRAGGLER_MS);
    expect(starts(b)).toHaveLength(2);
  });

  it('a round whose clock ran out can be followed by a new one', () => {
    const { room, b } = playing();
    const late = 120000 + 90000 + 1000; // past the round's time plus its slack
    for (const slot of [0, 1]) room.message(slot, msg({ t: 'ping', id: 1 }), late - 500); // still connected
    room.pump(late);
    expect(room.busy).toBe(false);
    room.message(0, msg({ t: 'start', seed: 6 }), late + 1);
    expect(starts(b)).toHaveLength(2);
  });
});

describe('room: a profile change without a name', () => {
  it('keeps the current name when the name is missing, empty, only spaces or not text; still takes the colour', () => {
    const room = new Room();
    const a = peer();
    room.connect(a, req({ create: true, name: 'Ana', color: 0 }), 0);
    const last = () => { const m = a.got.at(-1); return m?.t === 'profile' ? m.player : null; };
    const noNames: object[] = [{ color: 1 }, { name: '', color: 2 }, { name: '   ', color: 3 }, { name: 42, color: 4 }, { name: null, color: 5 }, { name: '<>', color: 6 }];
    for (const [k, m] of noNames.entries()) {
      room.message(0, msg({ t: 'profile', ...m }), k);
      expect(last(), JSON.stringify(m)).toEqual({ slot: 0, name: 'Ana', color: k + 1 });
    }
    room.message(0, msg({ t: 'profile', name: '  Bo  ', color: 6 }), 10);
    expect(last()).toEqual({ slot: 0, name: 'Bo', color: 6 });
  });
});
