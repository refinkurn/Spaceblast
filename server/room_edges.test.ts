import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_AWAY, CLOSE_LEAVE, FRAME_LEFT, type ServerMsg } from '../src/net/protocol';
import { Room, TICK_MS, type JoinRequest } from './room';

// Room behaviour around closes, errors and the round's end, plus the cost of
// sending (see room.test.ts for the main rules).

function peer() {
  const raw: string[] = [];
  return {
    raw,
    get got(): ServerMsg[] { return raw.map((d) => JSON.parse(d)); },
    closed: 0,
    send(d: string) { raw.push(d); },
    close(code = 1000) { this.closed = code; },
  };
}
const msg = (m: object) => JSON.stringify(m);
const req = (r: Partial<JoinRequest> = {}): JoinRequest => ({ create: false, ...r });
const frames = (p: ReturnType<typeof peer>) => p.got.flatMap((m) => (m.t === 'f' ? m.c.map((row, i) => ({ tick: m.tick + i, row })) : []));

function started(n = 2, now = 0) {
  const room = new Room();
  const ps = Array.from({ length: n }, () => peer());
  ps.forEach((p, i) => room.connect(p, req({ create: i === 0 }), now));
  room.message(0, msg({ t: 'start', seed: 5 }), now);
  return { room, ps };
}

afterEach(() => vi.restoreAllMocks());

describe('room: one encoding per message', () => {
  it('a frame and a broadcast are encoded once and the same text goes to everyone', () => {
    const { room, ps } = started(4);
    const spy = vi.spyOn(JSON, 'stringify');
    room.pump(3 * TICK_MS);
    expect(spy).toHaveBeenCalledTimes(1);
    const last = ps.map((p) => p.raw.at(-1));
    expect(new Set(last).size).toBe(1);
    expect(JSON.parse(last[0]!)).toEqual({ t: 'f', r: 1, tick: 0, c: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] });
    const hash = msg({ t: 'hash', r: 1, tick: 0, h: 9 });
    spy.mockClear();
    room.message(2, hash, 3 * TICK_MS); // relayed to the other three
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ps[2].got.some((m) => m.t === 'hash')).toBe(false);
    expect(ps[0].got.at(-1)).toEqual({ t: 'hash', slot: 2, r: 1, tick: 0, h: 9 });
  });

  it('nothing is encoded when nobody is connected to hear it', () => {
    const { room, ps } = started(2);
    room.closed(0, ps[0], 1006, 0);
    room.closed(1, ps[1], 1006, 0);
    const spy = vi.spyOn(JSON, 'stringify');
    room.pump(5 * TICK_MS);
    expect(spy).not.toHaveBeenCalled();
  });

  it('commands sent far ahead still land on their own ticks', () => {
    const { room, ps } = started(2);
    room.message(1, msg({ t: 'in', r: 1, tick: 100, c: [2 | 64, 2] }), 0);
    for (let t = 1; t <= 110; t++) room.pump(t * TICK_MS);
    const rows = frames(ps[0]);
    expect(rows.length).toBe(110);
    expect(rows[99].row[1]).toBe(0);
    expect(rows[100].row[1]).toBe(2 | 64);
    expect(rows[101].row[1]).toBe(2);
    expect(rows[109].row[1]).toBe(2); // the last move repeats, never the placing
  });
});

describe('room: error, then close', () => {
  it('a deliberate leave after an error frees the seat at once', () => {
    const { room, ps } = started(2);
    room.closed(1, ps[1], 1006, 10); // the error event: a drop, seat kept
    expect(ps[0].got.at(-1)).toEqual({ t: 'away', slot: 1, away: true });
    room.closed(1, ps[1], CLOSE_LEAVE, 11); // then the real close says the player left
    expect(ps[0].got.at(-1)).toEqual({ t: 'left', slot: 1, host: 0 });
    expect(room.busy).toBe(true); // the round is still on
    room.message(0, msg({ t: 'over', r: 1 }), 12);
    expect(room.busy).toBe(false); // no seat left waiting for its player
  });

  it('a second drop code after an error changes nothing', () => {
    const { room, ps } = started(2);
    room.closed(1, ps[1], 1006, 10);
    const before = ps[0].raw.length;
    room.closed(1, ps[1], 1006, 11);
    expect(ps[0].raw.length).toBe(before);
  });

  it("an old connection's leave never frees a seat its player rejoined", () => {
    const { room, ps } = started(2);
    const w = ps[1].got.find((m) => m.t === 'welcome');
    room.closed(1, ps[1], 1006, 10);
    const back = peer();
    expect(room.connect(back, req({ rejoin: 1, token: w?.t === 'welcome' ? w.token : '' }), 20)).toBe(1);
    room.closed(1, ps[1], CLOSE_LEAVE, 30);
    expect(ps[0].got.some((m) => m.t === 'left')).toBe(false);
    room.pump(5 * TICK_MS);
    expect(frames(back).length).toBe(5);
  });
});

describe('room: the end of a round', () => {
  it('a drop never stops the clock: the unfinished player rejoins, gets new frames and finishes', () => {
    const { room, ps } = started(2);
    const w = ps[1].got.find((m) => m.t === 'welcome');
    room.pump(10 * TICK_MS);
    room.message(0, msg({ t: 'over', r: 1 }), 10 * TICK_MS);
    room.closed(1, ps[1], 1006, 10 * TICK_MS);
    expect(room.busy).toBe(true);
    room.message(0, msg({ t: 'ping', id: 1 }), 40 * TICK_MS);
    room.pump(40 * TICK_MS);
    expect(frames(ps[0]).length).toBe(40); // still running
    const back = peer();
    expect(room.connect(back, req({ rejoin: 1, token: w?.t === 'welcome' ? w.token : '' }), 40 * TICK_MS)).toBe(1);
    const resume = back.got.find((m) => m.t === 'resume');
    expect(resume?.t === 'resume' && resume.c.length).toBe(40);
    room.pump(50 * TICK_MS);
    expect(frames(back).map((f) => f.tick)).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
    room.message(1, msg({ t: 'over', r: 1 }), 50 * TICK_MS);
    expect(room.busy).toBe(false);
    room.pump(60 * TICK_MS);
    expect(frames(back).length).toBe(10);
  });

  it('stops the clock when the unfinished player stays gone past the rejoin window', () => {
    const { room, ps } = started(2);
    room.pump(10 * TICK_MS);
    room.message(0, msg({ t: 'over', r: 1 }), 10 * TICK_MS);
    room.closed(1, ps[1], 1006, 10 * TICK_MS);
    room.message(0, msg({ t: 'ping', id: 1 }), 10 * TICK_MS + 20000);
    room.pump(10 * TICK_MS + 20000);
    expect(room.busy).toBe(true); // inside the window: frames go on
    const sent = frames(ps[0]).length;
    expect(sent).toBeGreaterThan(10);
    room.message(0, msg({ t: 'ping', id: 2 }), 10 * TICK_MS + 20001 + 50);
    room.pump(10 * TICK_MS + 20001 + 50); // B's seat expires: out for good
    expect(ps[0].got.some((m) => m.t === 'left' && m.slot === 1)).toBe(true);
    expect(room.busy).toBe(false);
    room.pump(10 * TICK_MS + 25000);
    expect(frames(ps[0]).length).toBe(sent);
  });

  it('freeing a seat that is not in the round leaves the clock alone', () => {
    const { room, ps } = started(2);
    const late = peer();
    expect(room.connect(late, req(), 5)).toBe(2); // joined after the start: not a round player
    room.message(0, msg({ t: 'over', r: 1 }), 5);
    room.closed(2, late, CLOSE_LEAVE, 6);
    expect(room.busy).toBe(true); // B has not finished
    room.pump(10 * TICK_MS);
    expect(frames(ps[1]).length).toBe(10);
  });

  it('stops the clock when the last unfinished player leaves after the others finished', () => {
    const { room, ps } = started(3);
    room.pump(10 * TICK_MS);
    room.message(0, msg({ t: 'over', r: 1 }), 10 * TICK_MS);
    room.message(1, msg({ t: 'over', r: 1 }), 10 * TICK_MS);
    room.closed(2, ps[2], CLOSE_LEAVE, 10 * TICK_MS);
    expect(room.busy).toBe(false);
  });

  it('keeps the clock running when everyone drops before finishing (they may rejoin)', () => {
    const { room, ps } = started(2);
    room.closed(0, ps[0], 1006, 0);
    room.closed(1, ps[1], 1006, 0);
    room.pump(5 * TICK_MS); // ticks 0-4 go to nobody
    const w = ps[0].got.find((m) => m.t === 'welcome');
    const back = peer();
    room.connect(back, req({ rejoin: 0, token: w?.t === 'welcome' ? w.token : '' }), 5 * TICK_MS);
    room.pump(10 * TICK_MS);
    expect(frames(back).length).toBe(5); // resume carried ticks 0-4, frames go on from 5
    expect(frames(back)[0].tick).toBe(5);
  });
});

describe('room: dead connections', () => {
  it('a silent peer whose close throws is still removed, and the clock keeps going', () => {
    const { room, ps } = started(2);
    ps[1].close = () => { throw new Error('already closed'); };
    room.message(0, msg({ t: 'ping', id: 1 }), 29000);
    expect(() => room.pump(31000)).not.toThrow();
    expect(ps[0].got.some((m) => m.t === 'left' && m.slot === 1)).toBe(true);
    room.message(0, msg({ t: 'ping', id: 2 }), 31500);
    room.pump(32000);
    expect(frames(ps[0]).at(-1)?.row[1]).toBe(FRAME_LEFT);
    expect(ps[0].closed).not.toBe(CLOSE_AWAY);
  });
});
