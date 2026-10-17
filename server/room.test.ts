import { describe, expect, it } from 'vitest';
import type { ServerMsg } from '../src/net/protocol';
import { Room } from './room';

function peer() {
  const got: ServerMsg[] = [];
  return { got, closed: false, send(d: string) { got.push(JSON.parse(d)); }, close() { this.closed = true; } };
}
const msg = (m: object) => JSON.stringify(m);

describe('room', () => {
  it('seats players with names and colours, and only the host starts', () => {
    const room = new Room();
    const a = peer(), b = peer();
    expect(room.join(a, true, { name: 'Ana', color: 3 })).toBe(0);
    expect(room.join(b, false, { name: '  Bo<b>  ', color: 3 })).toBe(1);
    const welcome = b.got[0];
    expect(welcome.t === 'welcome' && welcome.players).toEqual([
      { slot: 0, name: 'Ana', color: 3 },
      { slot: 1, name: 'Bob', color: 0 }, // colour 3 was taken
    ]);
    expect(a.got.at(-1)).toEqual({ t: 'profile', player: { slot: 1, name: 'Bob', color: 0 } });
    room.message(1, msg({ t: 'start', seed: 5 }));
    expect(a.got.some((m) => m.t === 'start')).toBe(false);
    room.message(0, msg({ t: 'start', seed: 5 }));
    const start = b.got.at(-1);
    expect(start?.t === 'start' && start.players.map((p) => p.slot)).toEqual([0, 1]);
    room.message(1, msg({ t: 'in', r: 1, tick: 6, c: [1, 2] }));
    expect(a.got.at(-1)).toEqual({ t: 'in', slot: 1, r: 1, tick: 6, c: [1, 2] });
    expect(b.got.at(-1)?.t).toBe('start'); // not echoed back
  });

  it('gives an empty name a default and refuses a colour someone has', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.join(a, true, { name: '', color: 1 });
    room.join(b, false, {});
    room.message(1, msg({ t: 'profile', name: 'Zed', color: 1 }));
    expect(a.got.at(-1)).toEqual({ t: 'profile', player: { slot: 1, name: 'Zed', color: 0 } });
    room.message(1, msg({ t: 'profile', name: '', color: 5 }));
    expect(a.got.at(-1)).toEqual({ t: 'profile', player: { slot: 1, name: 'Player 2', color: 5 } });
  });

  it('host settings are validated and bots keep the total at 4', () => {
    const room = new Room();
    const a = peer(), b = peer(), c = peer();
    room.join(a, true);
    room.message(0, msg({ t: 'settings', s: { time: 90, maze: true, blackout: false, bots: 3, botLevel: 'hard', match: 'bo3' } }));
    expect(a.got.at(-1)).toEqual({ t: 'settings', s: { time: 90, maze: true, blackout: false, bots: 3, botLevel: 'hard', match: 'bo3' } });
    room.message(0, msg({ t: 'settings', s: { time: 999, maze: 'yes', blackout: true, bots: 9, botLevel: 'godlike', match: 'bo99' } }));
    expect(a.got.at(-1)).toEqual({ t: 'settings', s: { time: 120, maze: false, blackout: true, bots: 3, botLevel: 'normal', match: 'ft3' } });
    room.join(b, false);
    expect(a.got.at(-1)).toEqual({ t: 'settings', s: { time: 120, maze: false, blackout: true, bots: 2, botLevel: 'normal', match: 'ft3' } });
    room.join(c, false);
    room.message(1, msg({ t: 'settings', s: { time: 60, maze: false, blackout: false, bots: 0 } })); // not the host
    expect(c.got.at(-1)?.t).toBe('welcome');
  });

  it('the host can start alone with bots, but not alone without', () => {
    const room = new Room();
    const a = peer();
    room.join(a, true);
    room.message(0, msg({ t: 'start', seed: 1 }));
    expect(a.got.some((m) => m.t === 'start')).toBe(false);
    room.message(0, msg({ t: 'settings', s: { time: 60, maze: false, blackout: false, bots: 1 } }));
    room.message(0, msg({ t: 'start', seed: 1 }));
    const start = a.got.at(-1);
    expect(start?.t === 'start' && start.settings.bots).toBe(1);
  });

  it('drops inputs from an old round and bad commands', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.join(a, true);
    room.join(b, false);
    room.message(0, msg({ t: 'start', seed: 1 }));
    room.message(0, msg({ t: 'start', seed: 2 }));
    const before = b.got.length;
    room.message(0, msg({ t: 'in', r: 1, tick: 6, c: [1] }));
    room.message(0, msg({ t: 'in', r: 2, tick: 6, c: [999] }));
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
    room.message(0, msg({ t: 'start', seed: 1 }));
    room.message(0, msg({ t: 'in', r: 1, tick: 6, c: [0, 0, 0] }));
    room.leave(0);
    expect(b.got.at(-1)).toEqual({ t: 'left', slot: 0, host: 1, lastTick: 8 });
    room.leave(1);
    room.leave(2);
    expect(room.empty).toBe(true);
  });

  it('drops a player who stops sending while the others play', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.join(a, true);
    room.join(b, false);
    room.message(0, msg({ t: 'start', seed: 1 }), 0);
    room.message(0, msg({ t: 'alive' }), 5000);
    expect(b.closed).toBe(false);
    room.message(1, msg({ t: 'in', r: 1, tick: 6, c: [0, 0] }), 1000);
    room.message(0, msg({ t: 'alive' }), 8999);
    expect(b.closed).toBe(false);
    room.message(0, msg({ t: 'alive' }), 9000);
    expect(b.closed).toBe(true);
    expect(a.got.at(-1)).toEqual({ t: 'left', slot: 1, host: 0, lastTick: 7 });
  });

  it('nobody is dropped while everyone waits between rounds', () => {
    const room = new Room();
    const a = peer(), b = peer();
    room.join(a, true);
    room.join(b, false);
    room.message(0, msg({ t: 'start', seed: 1 }), 0);
    room.message(0, msg({ t: 'start', seed: 2 }), 60_000);
    room.message(0, msg({ t: 'alive' }), 61_000);
    expect(b.closed).toBe(false);
  });
});

describe('room abuse', () => {
  function started() {
    const room = new Room();
    const a = peer(), b = peer();
    room.join(a, true);
    room.join(b, false);
    room.message(0, msg({ t: 'start', seed: 1 }), 0);
    return { room, a, b };
  }

  it('ignores inputs that skip ahead, so a cheater cannot freeze the room', () => {
    const { room, a, b } = started();
    room.message(1, msg({ t: 'in', r: 1, tick: 1_000_000, c: [0] }), 10);
    expect(a.got.at(-1)?.t).not.toBe('in');
    room.message(1, msg({ t: 'in', r: 1, tick: 6, c: [0, 0] }), 20);
    room.message(1, msg({ t: 'in', r: 1, tick: 50, c: [0] }), 30); // a gap
    room.message(1, msg({ t: 'in', r: 1, tick: 8, c: [0] }), 40);
    expect(a.got.filter((m) => m.t === 'in').map((m) => m.t === 'in' && m.tick)).toEqual([6, 8]);
    // Leaving reports the last real tick, not the bogus one.
    room.leave(1);
    expect(a.got.at(-1)).toEqual({ t: 'left', slot: 1, host: 0, lastTick: 8 });
    expect(b.closed).toBe(false);
  });

  it('disconnects a client that floods messages, but not a normal one', () => {
    const { room, a, b } = started();
    // Normal: ~32 messages a second for 10 seconds.
    for (let i = 0; i < 320; i++) room.message(0, msg({ t: 'alive' }), i * 31);
    expect(a.closed).toBe(false);
    for (let i = 0; i < 400; i++) room.message(1, msg({ t: 'alive' }), 10_000);
    expect(b.closed).toBe(true);
    expect(a.got.some((m) => m.t === 'left' && m.slot === 1)).toBe(true);
  });

  it('ignores oversized messages', () => {
    const { room, a } = started();
    const before = a.got.length;
    room.message(1, msg({ t: 'profile', name: 'x'.repeat(5000), color: 2 }), 5);
    expect(a.got.length).toBe(before);
  });
});
