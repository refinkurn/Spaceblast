import { describe, expect, it } from 'vitest';
import { FRAME_LEFT, type ServerMsg } from '../src/net/protocol';
import { Room, TICK_MS, type JoinRequest } from './room';

function peer() {
  const got: ServerMsg[] = [];
  return { got, closed: 0, send(d: string) { got.push(JSON.parse(d)); }, close(code = 1000) { this.closed = code; } };
}
const msg = (m: object) => JSON.stringify(m);
const req = (r: Partial<JoinRequest> = {}): JoinRequest => ({ create: false, ...r });
const frames = (p: ReturnType<typeof peer>) => p.got.flatMap((m) => (m.t === 'f' ? m.c.map((row, i) => ({ tick: m.tick + i, row })) : []));

/** A room with players a (host) and b, round started at t=0. */
function started(now = 0) {
  const room = new Room();
  const a = peer(), b = peer();
  room.connect(a, req({ create: true, name: 'Ana' }), now);
  room.connect(b, req({ name: 'Bo' }), now);
  room.message(0, msg({ t: 'start', seed: 5 }), now);
  return { room, a, b };
}

describe('room: seats and settings', () => {
  it('seats players with names and colours, and only the host starts', () => {
    const room = new Room();
    const a = peer(), b = peer();
    expect(room.connect(a, req({ create: true, name: 'Ana', color: 3 }))).toBe(0);
    expect(room.connect(b, req({ name: '  Bo<b>  ', color: 3 }))).toBe(1);
    const welcome = b.got[0];
    expect(welcome.t === 'welcome' && welcome.players).toEqual([
      { slot: 0, name: 'Ana', color: 3 },
      { slot: 1, name: 'Bob', color: 0 }, // colour 3 was taken
    ]);
    expect(welcome.t === 'welcome' && welcome.token.length).toBeGreaterThan(10);
    room.message(1, msg({ t: 'start', seed: 5 }));
    expect(a.got.some((m) => m.t === 'start')).toBe(false);
    room.message(0, msg({ t: 'start', seed: 5 }));
    const start = b.got.at(-1);
    expect(start?.t === 'start' && start.players.map((p) => p.slot)).toEqual([0, 1]);
  });

  it('host settings are validated and bots keep the total at 4', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.connect(a, req({ create: true }));
    room.message(0, msg({ t: 'settings', s: { time: 999, maze: 'yes', blackout: true, bots: 9, botLevel: 'godlike', match: 'bo99' } }));
    expect(a.got.at(-1)).toEqual({ t: 'settings', s: { time: 120, maze: false, blackout: true, bots: 3, botLevel: 'normal', match: 'ft3' } });
    room.connect(b, req());
    expect(a.got.at(-1)).toEqual({ t: 'settings', s: { time: 120, maze: false, blackout: true, bots: 2, botLevel: 'normal', match: 'ft3' } });
  });

  it('the host can start alone with bots, but not alone without', () => {
    const room = new Room();
    const a = peer();
    room.connect(a, req({ create: true }));
    room.message(0, msg({ t: 'start', seed: 1 }));
    expect(a.got.some((m) => m.t === 'start')).toBe(false);
    room.message(0, msg({ t: 'settings', s: { time: 60, bots: 1 } }));
    room.message(0, msg({ t: 'start', seed: 1 }));
    expect(a.got.at(-1)?.t).toBe('start');
  });

  it('rejects taken, missing and full rooms', () => {
    const room = new Room();
    const missing = peer();
    expect(room.connect(missing, req())).toBeNull();
    expect(missing.got[0]).toEqual({ t: 'error', reason: 'not_found' });
    room.connect(peer(), req({ create: true }));
    const taken = peer();
    expect(room.connect(taken, req({ create: true }))).toBeNull();
    for (let i = 0; i < 3; i++) room.connect(peer(), req());
    const full = peer();
    expect(room.connect(full, req())).toBeNull();
    expect(full.got[0]).toEqual({ t: 'error', reason: 'full' });
  });
});

describe('room: the round clock', () => {
  it("sends a frame for every tick on time, with each player's command", () => {
    const { room, a, b } = started();
    room.message(0, msg({ t: 'in', r: 1, tick: 3, c: [4, 4] }), 10);
    room.message(1, msg({ t: 'in', r: 1, tick: 3, c: [1 | 64] }), 10);
    room.pump(10 * TICK_MS);
    const fa = frames(a);
    expect(fa.map((f) => f.tick)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(fa[3].row).toEqual([4, 1 | 64]);
    // A missing command repeats the last direction, but never places again.
    expect(fa[4].row).toEqual([4, 1]);
    expect(fa[5].row).toEqual([4, 1]);
    expect(frames(b)).toEqual(fa);
  });

  it('a late command is too late: nobody waits for it', () => {
    const { room, a } = started();
    room.pump(20 * TICK_MS);
    room.message(1, msg({ t: 'in', r: 1, tick: 5, c: [2, 2] }), 20 * TICK_MS); // ticks 5-6 already sent
    room.pump(25 * TICK_MS);
    const fa = frames(a);
    expect(fa.length).toBe(25);
    expect(fa[5].row[1]).toBe(0);
  });

  it('ignores commands far in the future and bad commands', () => {
    const { room, a } = started();
    room.message(1, msg({ t: 'in', r: 1, tick: 100000, c: [4] }), 0);
    room.message(1, msg({ t: 'in', r: 1, tick: 2, c: [999] }), 0);
    room.message(1, msg({ t: 'in', r: 9, tick: 2, c: [4] }), 0);
    room.pump(5 * TICK_MS);
    expect(frames(a).every((f) => f.row[1] === 0)).toBe(true);
  });

  it('a dropped player keeps the seat, rejoins with the token and gets the round so far', () => {
    const { room, a, b } = started();
    const welcome = b.got.find((m) => m.t === 'welcome')!;
    const token = welcome.t === 'welcome' ? welcome.token : '';
    room.pump(30 * TICK_MS);
    room.closed(1, b, 1006, 30 * TICK_MS);
    expect(a.got.at(-1)).toEqual({ t: 'away', slot: 1, away: true });
    room.pump(90 * TICK_MS); // a keeps getting frames
    expect(frames(a).length).toBe(90);
    const wrong = peer();
    expect(room.connect(wrong, req({ rejoin: 1, token: 'nope' }), 100)).toBeNull();
    const back = peer();
    expect(room.connect(back, req({ rejoin: 1, token }), 90 * TICK_MS)).toBe(1);
    const resume = back.got.find((m) => m.t === 'resume');
    expect(resume?.t === 'resume' && resume.c.length).toBe(90);
    expect(a.got.at(-1)).toEqual({ t: 'away', slot: 1, away: false });
  });

  it('a rejoin replaces a connection that still looks open', () => {
    const { room, b } = started();
    const welcome = b.got.find((m) => m.t === 'welcome')!;
    const back = peer();
    expect(room.connect(back, req({ rejoin: 1, token: welcome.t === 'welcome' ? welcome.token : '' }), 50)).toBe(1);
    expect(b.closed).toBe(4003);
    room.closed(1, b, 4003, 60); // the old connection's close is ignored
    room.pump(10 * TICK_MS);
    expect(frames(back).length).toBe(10);
  });

  it('a player gone past the rejoin window is out (LEFT) from then on', () => {
    const { room, a } = started();
    room.closed(1, room ? ({} as never) : ({} as never), 1006, 0); // unknown peer: ignored
    room.pump(10 * TICK_MS);
    const b = (room as unknown as { seats: Map<number, { peer: unknown }> }).seats.get(1)!.peer as ReturnType<typeof peer>;
    room.closed(1, b, 1006, 10 * TICK_MS);
    room.pump(10 * TICK_MS + 21000);
    const last = frames(a).at(-1)!;
    expect(last.row[1]).toBe(FRAME_LEFT);
    expect(a.got.some((m) => m.t === 'left' && m.slot === 1)).toBe(true);
  });

  it('choosing to leave frees the seat at once', () => {
    const { room, a, b } = started();
    room.closed(1, b, 1000, 5);
    expect(a.got.at(-1)).toEqual({ t: 'left', slot: 1, host: 0 });
  });

  it('stops the clock when every player has finished the round', () => {
    const { room, a } = started();
    room.pump(10 * TICK_MS);
    room.message(0, msg({ t: 'over', r: 1 }), 10 * TICK_MS);
    expect(room.busy).toBe(true);
    room.message(1, msg({ t: 'over', r: 1 }), 10 * TICK_MS);
    expect(room.busy).toBe(false);
    room.pump(20 * TICK_MS);
    expect(frames(a).length).toBe(10);
  });
});

describe('room: abuse', () => {
  it('disconnects a client that floods messages, but not a normal one', () => {
    const { room, a, b } = started();
    for (let i = 0; i < 320; i++) room.message(0, msg({ t: 'ping', id: i }), i * 31);
    expect(a.closed).toBe(0);
    for (let i = 0; i < 400; i++) room.message(1, msg({ t: 'ping', id: i }), 10_000);
    expect(b.closed).toBe(4002);
    expect(a.got.some((m) => m.t === 'left' && m.slot === 1)).toBe(true);
  });

  it('ignores oversized messages', () => {
    const { room, a } = started();
    const before = a.got.length;
    room.message(1, msg({ t: 'profile', name: 'x'.repeat(5000), color: 2 }), 5);
    expect(a.got.length).toBe(before);
  });

  it('answers pings at once', () => {
    const { room, b } = started();
    room.message(1, msg({ t: 'ping', id: 42 }), 5);
    expect(b.got.at(-1)).toEqual({ t: 'pong', id: 42 });
  });
});
