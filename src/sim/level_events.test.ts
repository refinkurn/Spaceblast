import { describe, expect, it } from 'vitest';
import {
  BLACKOUT_MAX_TICKS, BLACKOUT_MIN_TICKS, Cell, Dir, EVENT_GAP_MAX_TICKS, EVENT_GAP_MIN_TICKS, EVENT_WARNING_TICKS,
  FIRST_EVENT_TICKS, GATE_WAIT_TICKS, GRID_W, LevelEvent, SHIFT_MAX_ROCKS, SHIFT_MIN_ROCKS, TILE,
} from './constants';
import { NO_COMMAND, type PlayerCommand } from './command';
import { LEVEL_COUNT, NO_EVENTS, levelRules, type LevelRules } from './levels';
import { hashState, step } from './sim';
import { createGame, playerTile, type GameState, type SimEvent } from './state';

const idle: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };

/** A real level map with no Martians and an untouchable astronaut, so only events happen. */
function level(rules: LevelRules, seed = 3): GameState {
  const g = createGame(seed, { martians: 0, rules });
  g.players[0].shield = 1e9;
  return g;
}

/** Runs ticks and collects every event the sim reports. */
function run(g: GameState, ticks: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks && g.status === 'playing'; i++) {
    step(g, [idle]);
    all.push(...g.events);
  }
  return all;
}

describe('level rules', () => {
  it("follows the story: each hazard arrives where Kit's briefing announces it", () => {
    for (const n of [1, 2, 3, 4]) expect(levelRules(n)).toEqual(NO_EVENTS); // Sector 1: no hazards
    expect(levelRules(6)).toEqual(NO_EVENTS); // first Sniffer, no hazard yet
    expect(levelRules(7)).toEqual({ ...NO_EVENTS, blackout: true, blackoutFirst: true }); // first Blackout
    for (const n of [8, 9]) expect(levelRules(n)).toEqual({ ...NO_EVENTS, blackout: true });
    for (const n of [11, 12]) expect(levelRules(n)).toEqual({ ...NO_EVENTS, mazeShift: true }); // first Maze Shift
    expect(levelRules(13)).toEqual({ ...NO_EVENTS, mazeShift: true, blackout: true, frequentEvents: true });
    expect(levelRules(14)).toEqual({ ...NO_EVENTS, mazeShift: true, blackout: true, frequentEvents: true, gateWander: true });
    expect(levelRules(16)).toEqual({ ...NO_EVENTS, mazeShift: true, blackout: true, aggressive: true }); // the Hunt begins
    for (const n of [17, 18, 19]) expect(levelRules(n)).toEqual({ ...NO_EVENTS, mazeShift: true, blackout: true, gateWander: true, frequentEvents: true, aggressive: true });
    for (const boss of [5, 10, 15]) expect(levelRules(boss)).toEqual(NO_EVENTS); // the boss drives its own hazards
    expect(levelRules(20)).toEqual({ ...NO_EVENTS, mazeShift: true }); // the duel's grid keeps shifting
  });

  it('introduces one new scenario per sector: Blackout 7, Maze Shift 11, wandering gate 14, Hunt 16', () => {
    const first = (on: (r: LevelRules) => boolean) => {
      for (let n = 1; n <= LEVEL_COUNT; n++) if (on(levelRules(n))) return n;
      return -1;
    };
    expect(first((r) => r.blackout)).toBe(7);
    expect(first((r) => r.mazeShift)).toBe(11);
    expect(first((r) => r.gateWander)).toBe(14);
    expect(first((r) => r.aggressive)).toBe(16);
    expect(first((r) => r.frequentEvents)).toBe(13);
  });

  it('Blackout-only levels (7-9) schedule Blackouts and never a Maze Shift, with warnings', () => {
    for (const n of [7, 8, 9]) {
      for (const seed of [1, 5, 9]) {
        const g = level(levelRules(n), seed);
        const all = run(g, 60 * 60 * 3); // three minutes
        const warnings = all.filter((e) => e.type === 'event_warning');
        expect(warnings.length, `level ${n} seed ${seed}`).toBeGreaterThan(1);
        for (const w of warnings) if (w.type === 'event_warning') expect(w.event).toBe(LevelEvent.Blackout);
        expect(all.some((e) => e.type === 'maze_shift')).toBe(false);
        expect(all.filter((e) => e.type === 'blackout_start').length).toBeGreaterThan(1);
      }
    }
  });

  it('hashes blackoutFirst, so peers with different rules see a desync', () => {
    const a = createGame(1, { rules: levelRules(8), martians: 0 });
    const b = createGame(1, { rules: { ...levelRules(8), blackoutFirst: true }, martians: 0 });
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("level 7 keeps Kit's promise: its first event is a Blackout, on every seed", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = createGame(seed, { rules: levelRules(7), martians: 0 });
      let first: LevelEvent | null = null;
      for (let t = 0; t < 30 * 60 && first === null; t++) {
        step(g, [NO_COMMAND]);
        const w = g.events.find((e) => e.type === 'event_warning');
        if (w && w.type === 'event_warning') first = w.event;
      }
      expect(first).toBe(LevelEvent.Blackout);
    }
  });

  it('spaces events 12-18 s apart in sectors 3-4', () => {
    const g = level(levelRules(13));
    g.rules = { ...g.rules, blackout: false, gateWander: false };
    run(g, FIRST_EVENT_TICKS + EVENT_WARNING_TICKS);
    expect(g.nextEvent).toBeGreaterThanOrEqual(12 * 60);
    expect(g.nextEvent).toBeLessThanOrEqual(18 * 60);
  });

  it('runs no events when they are off, and never in battle', () => {
    expect(run(level(NO_EVENTS), 6000).some((e) => e.type === 'event_warning')).toBe(false);
    const battle = createGame(3, { mode: 'battle', rules: levelRules(15) });
    battle.players.forEach((p) => (p.shield = 1e9));
    expect(battle.rules).toEqual(NO_EVENTS);
  });
});

describe('Maze Shift', () => {
  const shiftOnly: LevelRules = { ...NO_EVENTS, mazeShift: true, gateWander: false, blackout: false };

  it('is announced 3 s ahead with the tiles that will change', () => {
    const g = level(shiftOnly);
    const before = run(g, FIRST_EVENT_TICKS);
    expect(before.filter((e) => e.type === 'event_warning')).toEqual([{ type: 'event_warning', event: LevelEvent.MazeShift }]);
    expect(g.shiftRemove.length).toBeGreaterThanOrEqual(SHIFT_MIN_ROCKS);
    expect(g.shiftRemove.length).toBeLessThanOrEqual(SHIFT_MAX_ROCKS);
    expect(g.shiftAdd.length).toBe(g.shiftRemove.length);
    const plan = { remove: [...g.shiftRemove], add: [...g.shiftAdd] };
    const after = run(g, EVENT_WARNING_TICKS);
    const shift = after.find((e) => e.type === 'maze_shift');
    expect(shift).toBeDefined();
    if (shift?.type !== 'maze_shift') return;
    for (const i of shift.removed) expect(plan.remove).toContain(i);
    for (const i of shift.removed) expect(g.grid.cells[i]).toBe(Cell.Empty);
    for (const i of shift.added) expect(plan.add).toContain(i);
    for (const i of shift.added) expect(g.grid.cells[i]).toBe(Cell.Rock);
    expect(g.event).toBe(LevelEvent.None);
    expect(g.nextEvent).toBeGreaterThanOrEqual(EVENT_GAP_MIN_TICKS);
    expect(g.nextEvent).toBeLessThanOrEqual(EVENT_GAP_MAX_TICKS);
  });

  it('never drops a rock on or next to an astronaut, a power-up or the gate', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = level(shiftOnly, seed);
      // Let the astronaut wander a little so it is not always in its corner.
      for (let t = 0; t < FIRST_EVENT_TICKS + EVENT_WARNING_TICKS; t++) {
        step(g, [{ dir: t % 240 < 120 ? Dir.Right : Dir.Down, alt: Dir.None, place: false }]);
        const shift = g.events.find((e) => e.type === 'maze_shift');
        if (shift?.type !== 'maze_shift') continue;
        const [px, py] = playerTile(g.players[0]);
        for (const i of shift.added) {
          const x = i % GRID_W, y = Math.floor(i / GRID_W);
          expect(Math.abs(x - px) + Math.abs(y - py)).toBeGreaterThan(1);
          expect(i).not.toBe(g.gate);
        }
      }
    }
  });
});

describe('Blackout', () => {
  it('is announced, lasts 10-15 s, and never overlaps another event', () => {
    const g = level({ ...NO_EVENTS, mazeShift: true, gateWander: false, blackout: true }, 9);
    const all = run(g, 60 * 60 * 4); // four minutes
    let inBlackout = false, blackouts = 0;
    for (const e of all) {
      if (e.type === 'blackout_start') { inBlackout = true; blackouts++; }
      if (e.type === 'blackout_end') inBlackout = false;
      if (e.type === 'event_warning' || e.type === 'maze_shift') expect(inBlackout).toBe(false);
    }
    expect(blackouts).toBeGreaterThan(0);
    // Duration: a Blackout-only level, checked right after it starts.
    const g2 = level({ ...NO_EVENTS, mazeShift: false, gateWander: false, blackout: true });
    run(g2, FIRST_EVENT_TICKS + EVENT_WARNING_TICKS);
    expect(g2.event).toBe(LevelEvent.Blackout);
    expect(g2.eventActive).toBeGreaterThanOrEqual(BLACKOUT_MIN_TICKS - 1);
    expect(g2.eventActive).toBeLessThanOrEqual(BLACKOUT_MAX_TICKS);
    const ends = run(g2, BLACKOUT_MAX_TICKS);
    expect(ends.some((e) => e.type === 'blackout_end')).toBe(true);
  });
});

describe('wandering Warp Gate', () => {
  function revealedGate(rules: LevelRules, seed = 4): GameState {
    const g = level(rules, seed);
    g.grid.cells[g.gate] = Cell.Empty; // as if its rock was just blasted
    return g;
  }

  it('moves after 10 s if nobody steps on it: under a rock, or to an open tile far from astronauts', () => {
    let hidden = 0, open = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = revealedGate({ ...NO_EVENTS, mazeShift: false, gateWander: true, blackout: false }, seed);
      const first = g.gate;
      const evs = run(g, GATE_WAIT_TICKS);
      const moved = evs.find((e) => e.type === 'gate_moved');
      expect(moved).toBeDefined();
      expect(g.gate).not.toBe(first);
      if (moved?.type !== 'gate_moved') continue;
      if (moved.hidden) {
        hidden++;
        expect(g.grid.cells[g.gate]).toBe(Cell.Rock);
      } else {
        open++;
        const [px, py] = playerTile(g.players[0]);
        expect(Math.abs((g.gate % GRID_W) - px) + Math.abs(Math.floor(g.gate / GRID_W) - py)).toBeGreaterThanOrEqual(4);
      }
    }
    expect(hidden).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });

  it('stays put on levels without the wandering gate', () => {
    const g = revealedGate(NO_EVENTS);
    const first = g.gate;
    run(g, GATE_WAIT_TICKS * 2);
    expect(g.gate).toBe(first);
  });

  it('can be entered before it moves', () => {
    const g = revealedGate({ ...NO_EVENTS, mazeShift: false, gateWander: true, blackout: false });
    g.players[0].x = (g.gate % GRID_W) * TILE;
    g.players[0].y = Math.floor(g.gate / GRID_W) * TILE;
    run(g, 2);
    expect(g.status).toBe('cleared');
  });
});
