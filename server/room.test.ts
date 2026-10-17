import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../src/net/protocol';
import { Room } from './room';

function peer() {
  const got: ServerMsg[] = [];
  return { got, closed: false, send(d: string) { got.push(JSON.parse(d)); }, close() { this.closed = true; } };
}

describe('room', () => {
  it('seats players, lets only the host start, and forwards inputs to the others', () => {
    const room = new Room();
    const a = peer(), b = peer();
    expect(room.join(a, true)).toBe(0);
    expect(room.join(b, false)).toBe(1);
    expect(b.got[0]).toEqual({ t: 'welcome', you: 1, host: 0, slots: [0, 1], playing: false });
    room.message(1, JSON.stringify({ t: 'start', seed: 5 }));
    expect(a.got.some((m) => m.t === 'start')).toBe(false);
    room.message(0, JSON.stringify({ t: 'start', seed: 5 }));
    expect(b.got.at(-1)).toEqual({ t: 'start', r: 1, seed: 5, slots: [0, 1] });
    room.message(1, JSON.stringify({ t: 'in', r: 1, tick: 6, c: [1, 2] }));
    expect(a.got.at(-1)).toEqual({ t: 'in', slot: 1, r: 1, tick: 6, c: [1, 2] });
    expect(b.got.at(-1)?.t).toBe('start'); // not echoed back
  });

  it('drops inputs from an old round and bad commands', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.join(a, true);
    room.join(b, false);
    room.message(0, JSON.stringify({ t: 'start', seed: 1 }));
    room.message(0, JSON.stringify({ t: 'start', seed: 2 }));
    const before = b.got.length;
    room.message(0, JSON.stringify({ t: 'in', r: 1, tick: 6, c: [1] }));
    room.message(0, JSON.stringify({ t: 'in', r: 2, tick: 6, c: [999] }));
    room.message(0, 'not json');
    expect(b.got.length).toBe(before);
  });

  it('rejects taken, missing and full rooms', () => {
    const room = new Room();
    const missing = peer();
    expect(room.join(missing, false)).toBeNull();
    expect(missing.got[0]).toEqual({ t: 'error', reason: 'not_found' });
    room.join(peer(), true);
    const taken = peer();
    expect(room.join(taken, true)).toBeNull();
    expect(taken.got[0]).toEqual({ t: 'error', reason: 'taken' });
    for (let i = 0; i < 3; i++) room.join(peer(), false);
    const full = peer();
    expect(room.join(full, false)).toBeNull();
    expect(full.got[0]).toEqual({ t: 'error', reason: 'full' });
  });

  it('reports the last input tick of a leaver and passes the host on', () => {
    const room = new Room();
    const a = peer(), b = peer(), c = peer();
    room.join(a, true);
    room.join(b, false);
    room.join(c, false);
    room.message(0, JSON.stringify({ t: 'start', seed: 1 }));
    room.message(0, JSON.stringify({ t: 'in', r: 1, tick: 6, c: [0, 0, 0] }));
    room.leave(0);
    expect(b.got.at(-1)).toEqual({ t: 'left', slot: 0, host: 1, lastTick: 8 });
    room.leave(1);
    room.leave(2);
    expect(room.empty).toBe(true);
  });
});
