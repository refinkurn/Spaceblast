import { describe, expect, it } from 'vitest';
import {
  BOOTS_SPEED, Cell, Dir, FREEZE_TICKS, GOOPLING_SPEED, GRID_W, Item, Kind, MARTIAN_SPAWN_DISTANCE, PLAYER_SPEED,
  SPAWNS, START_LIVES, TILE, VEST_TICKS, type Dir as DirT,
} from './constants';
import type { PlayerCommand } from './command';
import { cellAt, isWalkable } from './grid';
import { gateOpen, playerSpeed } from './items';
import { step } from './sim';
import { createGame, type GameState } from './state';

const cmd = (dir: DirT = Dir.None, place = false): PlayerCommand => ({ dir, alt: Dir.None, place });
const idle = cmd();

function run(g: GameState, c: PlayerCommand, ticks: number) {
  for (let i = 0; i < ticks; i++) step(g, [c]);
}

/** Empty arena (pillars only), optionally with Martians placed by hand. */
function arena(): GameState {
  const g = createGame(1, { martians: 0 });
  g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) g.grid.cells[i] = Cell.Empty; });
  g.items.fill(0);
  g.gate = -1;
  return g;
}

const idx = (x: number, y: number) => y * GRID_W + x;

function addGoopling(g: GameState, tx: number, ty: number) {
  g.martians.push({ id: g.martians.length + 1, kind: Kind.Goopling, x: tx * TILE, y: ty * TILE, dir: Dir.None, alive: true });
  return g.martians[g.martians.length - 1];
}

describe('level generation', () => {
  it('hides power-ups and the Warp Gate only under rocks', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = createGame(seed);
      g.items.forEach((item, i) => { if (item !== Item.None) expect(g.grid.cells[i]).toBe(Cell.Rock); });
      expect(g.grid.cells[g.gate]).toBe(Cell.Rock);
      expect(g.items[g.gate]).toBe(Item.None);
    }
  });

  it('puts a power-up under roughly 1 in 6 rocks', () => {
    let rocks = 0, items = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const g = createGame(seed);
      g.grid.cells.forEach((c, i) => { if (c === Cell.Rock) { rocks++; if (g.items[i]) items++; } });
    }
    expect(items / rocks).toBeGreaterThan(0.12);
    expect(items / rocks).toBeLessThan(0.22);
  });

  it('spawns 3 Gooplings away from every spawn corner', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = createGame(seed);
      expect(g.martians).toHaveLength(3);
      for (const m of g.martians) {
        const tx = m.x / TILE, ty = m.y / TILE;
        expect(isWalkable(g.grid, tx, ty)).toBe(true);
        for (const [sx, sy] of SPAWNS) expect(Math.abs(tx - sx) + Math.abs(ty - sy)).toBeGreaterThanOrEqual(MARTIAN_SPAWN_DISTANCE);
      }
    }
  });
});

describe('power-ups', () => {
  it('reveals a power-up when its rock breaks, then picks it up', () => {
    const g = arena();
    g.grid.cells[idx(2, 0)] = Cell.Rock;
    g.items[idx(2, 0)] = Item.BeamRange;
    step(g, [cmd(Dir.None, true)]); // charge at (0,0)
    run(g, cmd(Dir.Down), 70); // walk ~4.5 tiles down the open edge, out of range
    run(g, idle, 150);
    expect(cellAt(g.grid, 2, 0)).toBe(Cell.Empty);
    expect(g.items[idx(2, 0)]).toBe(Item.BeamRange); // revealed, not burnt
    g.players[0].x = 2 * TILE; g.players[0].y = 0;
    step(g, [idle]);
    expect(g.players[0].range).toBe(3);
    expect(g.items[idx(2, 0)]).toBe(Item.None);
  });

  it('destroys a power-up already lying in the open', () => {
    const g = arena();
    g.items[idx(2, 0)] = Item.ExtraCharge;
    step(g, [cmd(Dir.None, true)]);
    run(g, cmd(Dir.Down), 70);
    run(g, idle, 150);
    expect(g.items[idx(2, 0)]).toBe(Item.None);
    expect(g.players[0].maxCharges).toBe(1);
  });

  it('applies every power-up', () => {
    const pick = (item: Item) => {
      const g = arena();
      g.items[idx(1, 0)] = item;
      run(g, cmd(Dir.Right), 20);
      return g;
    };
    expect(pick(Item.ExtraCharge).players[0].maxCharges).toBe(2);
    const boots = pick(Item.JetBoots).players[0];
    expect(boots.boots).toBe(1);
    expect(playerSpeed(boots)).toBe(PLAYER_SPEED + BOOTS_SPEED);
    expect(pick(Item.OxygenVest).players[0].vest).toBeGreaterThan(VEST_TICKS - 20);
    expect(pick(Item.FreezePulse).freeze).toBeGreaterThan(FREEZE_TICKS - 20);
  });
});

describe('Martians', () => {
  it('moves at Goopling speed and only along open lanes', () => {
    const g = createGame(5);
    for (let t = 0; t < 1200; t++) {
      const before = g.martians.map((m) => [m.x, m.y]);
      step(g, [idle]);
      g.martians.forEach((m, i) => {
        if (!m.alive) return;
        const moved = Math.abs(m.x - before[i][0]) + Math.abs(m.y - before[i][1]);
        expect(moved).toBeLessThanOrEqual(GOOPLING_SPEED);
        expect(m.x % TILE === 0 || m.y % TILE === 0).toBe(true); // on a lane
        for (const tx of [Math.floor(m.x / TILE), Math.ceil(m.x / TILE)])
          for (const ty of [Math.floor(m.y / TILE), Math.ceil(m.y / TILE)])
            expect(cellAt(g.grid, tx, ty)).not.toBe(Cell.Pillar);
      });
    }
  });

  it('stops while a Freeze Pulse lasts', () => {
    const g = arena();
    const m = addGoopling(g, 6, 6);
    g.freeze = 30;
    run(g, idle, 29);
    expect(m).toMatchObject({ x: 6 * TILE, y: 6 * TILE });
    run(g, idle, 10);
    expect(m.x !== 6 * TILE || m.y !== 6 * TILE).toBe(true);
  });

  it('is defeated by a beam', () => {
    const g = arena();
    const m = addGoopling(g, 2, 0);
    g.freeze = 999; // hold it in place
    step(g, [cmd(Dir.None, true)]);
    run(g, cmd(Dir.Down), 70);
    run(g, idle, 150);
    expect(m.alive).toBe(false);
  });

  it('bites an astronaut, unless the vest or the spawn shield protects it', () => {
    const g = arena();
    addGoopling(g, 1, 0);
    g.freeze = 999;
    run(g, cmd(Dir.Right), 10);
    expect(g.players[0].alive).toBe(false);
    expect(g.players[0].lives).toBe(START_LIVES - 1);

    const v = arena();
    addGoopling(v, 1, 0);
    v.freeze = 999;
    v.players[0].vest = VEST_TICKS;
    run(v, cmd(Dir.Right), 10);
    expect(v.players[0].alive).toBe(true);
  });
});

describe('lives and the Warp Gate', () => {
  it('ends the game when the last life is lost', () => {
    const g = arena();
    for (let life = 0; life < START_LIVES; life++) {
      step(g, [cmd(Dir.None, true)]);
      run(g, idle, 300); // stand on the charge, get knocked out, warp back
    }
    expect(g.status).toBe('game_over');
  });

  it('opens the gate only when it is revealed and every Martian is gone', () => {
    const g = arena();
    g.gate = idx(4, 0);
    const m = addGoopling(g, 10, 8);
    g.freeze = 9999;
    expect(gateOpen(g)).toBe(false);
    m.alive = false;
    expect(gateOpen(g)).toBe(true);
    g.grid.cells[idx(4, 0)] = Cell.Rock;
    expect(gateOpen(g)).toBe(false);
  });

  it('clears the level when an astronaut steps on the open gate', () => {
    const g = arena();
    g.gate = idx(3, 0);
    run(g, cmd(Dir.Right), 60);
    expect(g.status).toBe('cleared');
    const tick = g.tick;
    run(g, cmd(Dir.Right), 10);
    expect(g.tick).toBe(tick); // the game stops once cleared
  });
});
