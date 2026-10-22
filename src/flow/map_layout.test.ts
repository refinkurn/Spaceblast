import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, levelSpec } from '../sim/levels';
import { scoreTarget } from '../services/score';
import { LEVELS_PER_SECTOR, MAP_SECTORS, mapNodes, nodeOf, sectorsShown } from './map_layout';
import { bestLine, bossLabel, coreSignal, enterLabel, nodeGoal, sectorStars, sectorTitle, starChecklist } from './map_text';

describe('story map layout', () => {
  it('has a node for every level 1-20, inside its panel, in 4 sectors of 5', () => {
    expect(MAP_SECTORS).toHaveLength(4);
    const nodes = mapNodes();
    expect(nodes.map((n) => n.level)).toEqual(Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1));
    for (const n of nodes) {
      expect(n.sector).toBe(levelSpec(n.level).sector);
      for (const v of [n.x, n.y]) {
        expect(v).toBeGreaterThan(5);
        expect(v).toBeLessThan(95);
      }
    }
  });

  it('puts the boss (or the duel) on the last node of each sector, and only there', () => {
    for (const n of mapNodes()) {
      const spec = levelSpec(n.level);
      const special = spec.boss !== 0 || spec.rival;
      expect(special).toBe(n.index === LEVELS_PER_SECTOR - 1);
      expect(bossLabel(n.level) !== null).toBe(special);
    }
    expect([5, 10, 15, 20].map(bossLabel)).toEqual(['Goopling Hive', 'Darkness Hive', 'Maze Master', 'Ducking']);
  });

  it('nodes in a sector run left to right and keep apart', () => {
    for (const s of MAP_SECTORS) {
      for (let i = 1; i < s.nodes.length; i++) expect(s.nodes[i][0] - s.nodes[i - 1][0]).toBeGreaterThanOrEqual(12);
    }
  });

  it('shows sectors up to one past the current one', () => {
    expect(sectorsShown(1)).toBe(2);
    expect(sectorsShown(5)).toBe(2);
    expect(sectorsShown(6)).toBe(3);
    expect(sectorsShown(16)).toBe(4);
    expect(sectorsShown(20)).toBe(4);
    expect(nodeOf(8)).toMatchObject({ sector: 2, index: 2 });
  });
});

describe('story map text', () => {
  it('fills the Core signal gauge with cleared levels', () => {
    expect(coreSignal(1, false)).toEqual({ filled: 0, label: 'CORE SIGNAL 0/20', done: false });
    expect(coreSignal(8, false).label).toBe('CORE SIGNAL 7/20');
    expect(coreSignal(20, true)).toEqual({ filled: 20, label: 'CORES RECOVERED', done: true });
  });

  it('titles a sector and counts its stars', () => {
    expect(sectorTitle(2)).toBe('SECTOR 2 · DEEP SHAFTS');
    const stars: Record<number, number> = { 6: 3, 7: 2, 8: 1, 1: 3 };
    expect(sectorStars(2, (n) => stars[n] ?? 0)).toBe('★ 6/15');
  });

  it('names the goal with the Martian count, or the boss / duel goal', () => {
    expect(nodeGoal(1)).toBe('Find the Warp Gate · 2 Martians');
    expect(nodeGoal(5)).toBe('Survive 3 waves');
    expect(nodeGoal(20)).toBe('Stun Ducking');
  });

  it('ticks the checklist lines for the stars already earned', () => {
    const lines = starChecklist(3, 2);
    expect(lines.map((l) => l.done)).toEqual([true, true, false]);
    expect(lines[0].text).toBe('Clear the level');
    expect(lines[1].text).toBe(`Score ${scoreTarget(3).toLocaleString('en-US')}`);
    expect(lines[2].text).toBe('Keep all 3 hearts, under 75 s');
    expect(starChecklist(5, 0)[2].text).toBe('Keep all 3 hearts'); // bosses have no par
    expect(starChecklist(20, 3).every((l) => l.done)).toBe(true);
    expect(starChecklist(20, 0)[2].text).toBe('Keep all 3 hearts, under 60 s');
  });

  it('shows the best score and the right Enter label', () => {
    expect(bestLine(0)).toBe('');
    expect(bestLine(8540)).toBe('Best: 8,540');
    expect(enterLabel(3)).toBe('ENTER');
    expect(enterLabel(6)).toBe('ENTER TUNNEL');
  });
});
