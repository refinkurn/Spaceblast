import { describe, expect, it } from 'vitest';
import { Dir } from '../sim/constants';
import type { PlayerCommand } from '../sim/command';
import { hashState, step } from '../sim/sim';
import { createGame } from '../sim/state';
import { Lockstep } from './lockstep';
import { packCommand, unpackCommand } from './protocol';

/** A deterministic "random" input for player p at local read number n. */
function input(p: number, n: number): PlayerCommand {
  const k = (n * 7 + p * 13) % 97;
  return { dir: ((k >> 2) % 5) as Dir, alt: Dir.None, place: k % 23 === 0 };
}

/** Runs n browsers over a fake network where every message takes `lag(n)` frames. */
function simulate(players: number, frames: number, lag: (msg: number) => number, leaveAt?: { player: number; frame: number }) {
  const seed = 1234;
  const peers = Array.from({ length: players }, (_, p) => ({
    ls: new Lockstep(players, p),
    state: createGame(seed, { mode: 'battle', players }),
    reads: 0,
    gone: false,
    hashes: [] as number[],
  }));
  const wire: { at: number; to: number; from: number; tick: number; c: number[]; left?: boolean }[] = [];
  let msgs = 0;
  for (let f = 0; f < frames; f++) {
    for (const m of wire.filter((w) => w.at === f)) {
      const peer = peers[m.to];
      if (m.left) peer.ls.playerLeft(m.from, m.tick);
      else peer.ls.receive(m.from, m.tick, m.c);
    }
    peers.forEach((peer, p) => {
      if (peer.gone) return;
      if (leaveAt && leaveAt.player === p && leaveAt.frame === f) {
        peer.gone = true;
        // The relay's lastTick: the last tick this peer sent input for.
        const last = peer.ls.tick - 1 + peer.ls.delay - (peer.ls as unknown as { outbox: number[] }).outbox.length;
        for (let q = 0; q < players; q++) if (q !== p) wire.push({ at: f + lag(msgs++), to: q, from: p, tick: last, c: [], left: true });
        return;
      }
      if (peer.ls.ready() && peer.state.status === 'playing') {
        step(peer.state, peer.ls.advance(input(p, peer.reads++)));
        peer.hashes[peer.state.tick] = hashState(peer.state);
      }
      const out = peer.ls.takeOutgoing(!peer.ls.ready());
      if (out) for (let q = 0; q < players; q++) if (q !== p) wire.push({ at: f + lag(msgs++), to: q, from: p, ...out });
    });
  }
  return peers;
}

describe('lockstep', () => {
  it('packs commands into 7 bits and back', () => {
    for (const dir of [0, 1, 2, 3, 4] as Dir[]) for (const alt of [0, 3] as Dir[]) for (const place of [false, true]) {
      expect(unpackCommand(packCommand({ dir, alt, place }))).toEqual({ dir, alt, place });
    }
  });

  it('keeps every browser in the same state, even with uneven lag', () => {
    const peers = simulate(4, 900, (n) => 1 + ((n * 37) % 9));
    // The bots' random inputs blow each other up: the round ends after ~160 ticks.
    expect(peers.every((p) => p.state.status === 'round_over')).toBe(true);
    expect(Math.min(...peers.map((p) => p.state.tick))).toBeGreaterThan(100);
    expectSameHashes(peers);
  });

  it('waits for late input instead of guessing', () => {
    const ls = new Lockstep(2, 0, 3);
    for (let i = 0; i < 3; i++) {
      expect(ls.ready()).toBe(true);
      ls.advance({ dir: Dir.Up, alt: Dir.None, place: false });
    }
    expect(ls.ready()).toBe(false);
    ls.receive(1, 3, [0, 0]);
    expect(ls.ready()).toBe(true);
    expect(ls.advance({ dir: Dir.None, alt: Dir.None, place: false })[0].dir).toBe(Dir.Up);
  });

  it('a player who leaves forfeits on the same tick everywhere', () => {
    const peers = simulate(3, 600, (n) => 1 + (n % 4), { player: 2, frame: 40 });
    const [a, b] = peers;
    expect(a.state.tick).toBeGreaterThan(100);
    expect(a.state.players[2].alive).toBe(false);
    expect(b.state.players[2].alive).toBe(false);
    expectSameHashes([a, b]);
  });
});

function expectSameHashes(peers: { hashes: number[] }[]): void {
  const shortest = Math.min(...peers.map((p) => p.hashes.length));
  for (let t = 1; t < shortest; t++) {
    const set = new Set(peers.map((p) => p.hashes[t]));
    expect(set.size, `tick ${t}`).toBe(1);
  }
}
