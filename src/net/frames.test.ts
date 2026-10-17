import { describe, expect, it } from 'vitest';
import { Room, type Peer } from '../../server/room';
import { Bot } from '../input/bot';
import { Dir } from '../sim/constants';
import { hashState, step } from '../sim/sim';
import { createGame, type GameState } from '../sim/state';
import { FrameSync } from './frames';
import { packCommand, unpackCommand, type ServerMsg } from './protocol';

/**
 * A room on a virtual network: each browser has its own one-way latency.
 * Time moves in 4 ms steps; browsers run a 60 fps loop, the server its clock.
 */
function network(latencies: number[], opts: { dropAt?: number; rejoinAt?: number; dropWho?: number } = {}) {
  const room = new Room();
  let now = 0;
  const wire: { at: number; deliver: () => void }[] = [];
  const send = (delay: number, deliver: () => void) => wire.push({ at: now + delay, deliver });

  const clients = latencies.map((lat, idx) => {
    const c = {
      idx, lat, slot: -1, token: '', peer: null as Peer | null, state: null as GameState | null,
      sync: null as FrameSync | null, bot: new Bot(idx, 99, 'normal'), hashes: new Map<number, number>(),
      maxBehind: 0, connected: false,
      onMsg(m: ServerMsg) {
        if (m.t === 'welcome') { c.slot = m.you; c.token = m.token; }
        if (m.t === 'start' || m.t === 'resume') {
          c.state = createGame(m.seed, { mode: 'battle', players: m.players.length, roundTicks: 60 * 60 });
          c.sync = new FrameSync(m.players.length);
          c.sync.setRtt(lat * 2);
          c.hashes.clear();
          if (m.t === 'resume') c.sync.receive(0, m.c, now);
        }
        if (m.t === 'f' && c.sync) c.sync.receive(m.tick, m.c, now);
      },
    };
    return c;
  });

  const connect = (c: (typeof clients)[number], create: boolean, rejoin = false) => {
    const peer: Peer = { send: (d) => send(c.lat, () => peer === c.peer && c.onMsg(JSON.parse(d))), close: () => {} };
    c.peer = peer;
    c.connected = true;
    const slot = room.connect(peer, { create, rejoin: rejoin ? c.slot : null, token: rejoin ? c.token : null, name: `P${c.idx}` }, now);
    expect(slot).not.toBeNull();
  };
  const toServer = (c: (typeof clients)[number], msg: object) => {
    const slot = c.slot, peer = c.peer;
    send(c.lat, () => peer === c.peer && c.connected && room.message(slot, JSON.stringify(msg), now));
  };

  connect(clients[0], true);
  for (const c of clients.slice(1)) connect(c, false);
  // Let the welcomes arrive, then the host starts.
  const run = (until: number) => {
    for (; now < until; now += 4) {
      wire.sort((a, b) => a.at - b.at);
      while (wire.length && wire[0].at <= now) wire.shift()!.deliver();
      if (now % 16 === 0) room.pump(now);
      if (opts.dropAt !== undefined && now === opts.dropAt) {
        const c = clients[opts.dropWho ?? 2];
        c.connected = false;
        c.peer = null;
        room.closed(c.slot, [...[]][0] as unknown as Peer, 1006, now); // wrong peer: ignored
      }
      if (now % 16 !== 0) continue;
      for (const c of clients) {
        if (!c.sync || !c.state || !c.connected) continue;
        // Play due ticks: one per frame, more to catch up when behind.
        let steps = 0;
        while (c.sync.ready() && c.state.status === 'playing' && (steps === 0 || (c.sync.buffered > 3 && steps < 10))) {
          step(c.state, c.sync.next());
          c.hashes.set(c.state.tick, hashState(c.state));
          steps++;
        }
        c.sync.input(c.bot.think(c.state));
        const out = c.sync.takeOutgoing();
        if (out) toServer(c, { t: 'in', r: 1, ...out });
        const startAt = (room as unknown as { round: { startAt: number } | null }).round?.startAt ?? now;
        const serverTick = Math.floor((now - startAt) / (1000 / 60));
        if (now > 3000 && c.state.status === 'playing') c.maxBehind = Math.max(c.maxBehind, serverTick - c.state.tick);
      }
    }
  };
  return { room, clients, run, connect, toServer, get now() { return now; }, set now(v) { now = v; } };
}

function sameHashes(a: Map<number, number>, b: Map<number, number>) {
  let compared = 0;
  for (const [t, h] of a) {
    if (!b.has(t)) continue;
    expect(b.get(t), `tick ${t}`).toBe(h);
    compared++;
  }
  return compared;
}

describe('server-clock online rounds', () => {
  it('packs commands into 7 bits and back', () => {
    for (const dir of [0, 1, 2, 3, 4] as Dir[]) for (const alt of [0, 3] as Dir[]) for (const place of [false, true]) {
      expect(unpackCommand(packCommand({ dir, alt, place }))).toEqual({ dir, alt, place });
    }
  });

  it('a player with a terrible connection does not slow down the others, and every game stays identical', () => {
    // Two players at 20 ms, one at 350 ms one-way (700 ms ping).
    const net = network([20, 20, 350]);
    net.run(200);
    net.toServer(net.clients[0], { t: 'start', seed: 7 });
    net.run(12000);
    const [a, b, slow] = net.clients;
    // The fast players stay close to the server's clock (well under 0.2 s behind)...
    expect(a.maxBehind).toBeLessThan(12);
    expect(b.maxBehind).toBeLessThan(12);
    // ...while only the slow one runs behind.
    expect(slow.maxBehind).toBeGreaterThan(15);
    expect(a.state!.tick).toBeGreaterThan(500);
    expect(sameHashes(a.hashes, b.hashes)).toBeGreaterThan(100);
    expect(sameHashes(a.hashes, slow.hashes)).toBeGreaterThan(100);
  });

  it('a dropped player reconnects, catches up from the round so far, and stays in sync', () => {
    const net = network([20, 20, 40]);
    net.run(200);
    net.toServer(net.clients[0], { t: 'start', seed: 11 });
    net.run(3000);
    const [a, , c] = net.clients;
    // c's connection drops.
    const oldPeer = c.peer!;
    c.connected = false;
    c.peer = null;
    net.room.closed(c.slot, oldPeer, 1006, net.now);
    net.run(6000);
    const aTickDuringDrop = a.state!.tick;
    expect(aTickDuringDrop).toBeGreaterThan(300); // a kept playing
    // c comes back within 20 s and gets the round so far.
    net.connect(c, false, true);
    net.run(9000);
    expect(c.state!.tick).toBeGreaterThan(400);
    expect(sameHashes(a.hashes, c.hashes)).toBeGreaterThan(50);
  });

  it('a player who stays gone past the rejoin window is out of the round for everyone', () => {
    const net = network([20, 20, 20]);
    net.run(200);
    net.toServer(net.clients[0], { t: 'start', seed: 5 });
    net.run(2000);
    const [a, b, c] = net.clients;
    const oldPeer = c.peer!;
    c.connected = false;
    c.peer = null;
    net.room.closed(c.slot, oldPeer, 1006, net.now);
    net.run(25000);
    expect(a.state!.players[2].alive).toBe(false);
    expect(b.state!.players[2].alive).toBe(false);
    expect(sameHashes(a.hashes, b.hashes)).toBeGreaterThan(100);
  });
});
