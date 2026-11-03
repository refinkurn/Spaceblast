import { describe, expect, it } from 'vitest';
import { Cell, Kind, ROCK_DENSITY_PERCENT } from './constants';
import { arenaLayout, arenaPillar } from './arenas';
import { inSpawnZone } from './grid';
import { LEVEL_COUNT, levelRoster, levelSpec, storyOptions } from './levels';
import { createGame } from './state';

const { Goopling: G, Chaser: C } = Kind;

/** Share of the floor tiles outside the spawn zones that start as rocks, over many seeds. */
function rockShare(make: (seed: number) => ReturnType<typeof createGame>): number {
  let rocks = 0, floor = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = make(seed);
    g.grid.cells.forEach((c, i) => {
      const x = i % g.grid.w, y = Math.floor(i / g.grid.w);
      if (arenaPillar(g.arena, x, y) || inSpawnZone(x, y)) return;
      floor++;
      if (c === Cell.Rock) rocks++;
    });
  }
  return rocks / floor;
}

describe('story stages', () => {
  it('sector 1 rosters: 2 Gooplings, 3 Gooplings, 2 Gooplings + 2 Chasers, 4 Chasers', () => {
    expect(levelRoster(1)).toEqual([G, G]);
    expect(levelRoster(2)).toEqual([G, G, G]);
    expect(levelRoster(3)).toEqual([G, G, C, C]);
    expect(levelRoster(4)).toEqual([C, C, C, C]);
    for (let level = 6; level <= LEVEL_COUNT; level++) expect(levelRoster(level)).not.toContain(C); // Chasers are sector 1 only
  });

  it('stage numbers, pars and rock density: stages 1-4 = 90/80/75/60 s and 50/55/60/65 %; bosses and the duel 60 %', () => {
    const rows = Array.from({ length: LEVEL_COUNT }, (_, i) => {
      const s = levelSpec(i + 1);
      return [s.stage, s.par, s.rockDensity];
    });
    for (let sector = 0; sector < 4; sector++) {
      expect(rows.slice(sector * 5, sector * 5 + 4)).toEqual([[1, 90, 50], [2, 80, 55], [3, 75, 60], [4, 60, 65]]);
    }
    expect([rows[4], rows[9], rows[14]]).toEqual([[5, null, 60], [5, null, 60], [5, null, 60]]);
    expect(rows[19]).toEqual([5, 60, ROCK_DENSITY_PERCENT]);
  });

  it('storyOptions passes the level density to the grid', () => {
    expect(storyOptions(4)).toMatchObject({ roster: [C, C, C, C], arena: 1, rockDensity: 65 });
    const low = rockShare((seed) => createGame(seed, storyOptions(1)));
    const high = rockShare((seed) => createGame(seed, storyOptions(4)));
    expect(low).toBeGreaterThan(0.46);
    expect(low).toBeLessThan(0.54);
    expect(high).toBeGreaterThan(0.61);
    expect(high).toBeLessThan(0.69);
  });

  it('keeps the spawn corners clear at any density', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame(seed, { martians: 0, rockDensity: 100 });
      g.grid.cells.forEach((c, i) => {
        if (inSpawnZone(i % g.grid.w, Math.floor(i / g.grid.w))) expect(c).not.toBe(Cell.Rock);
      });
    }
  });

  it('battle ignores a rock density option and keeps the layout density', () => {
    const a = createGame(5, { mode: 'battle', arena: 2, rockDensity: 10 });
    const b = createGame(5, { mode: 'battle', arena: 2 });
    expect([...a.grid.cells]).toEqual([...b.grid.cells]);
    expect(arenaLayout(2).rockDensity).toBe(60);
  });
});
