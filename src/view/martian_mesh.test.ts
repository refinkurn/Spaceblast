import { describe, expect, it } from 'vitest';
import { BossKind, Kind } from '../sim/constants';
import { animateBoss, makeBoss } from './boss_mesh';
import { animateMartian, makeMartian, type MartianParts } from './martian_mesh';
import { MARTIAN_COLOR } from './play_colors';

const parts = (kind: number) => makeMartian(kind).userData.parts as MartianParts;

describe('low-poly Martians', () => {
  it('gives each species its own parts, in its gameplay colour', () => {
    expect(parts(Kind.Goopling).tentacles).toHaveLength(6);
    expect(parts(Kind.Sniffer).legs).toHaveLength(4);
    expect(parts(Kind.Sniffer).snout).toBeTruthy();
    expect(parts(Kind.Sniffer).feelers).toHaveLength(2);
    expect(parts(Kind.Phaser).ring).toBeTruthy();
    expect(parts(Kind.Builder).claws).toHaveLength(2);
    for (const k of [Kind.Goopling, Kind.Sniffer, Kind.Phaser, Kind.Builder]) expect(parts(k).skin.color.getHex()).toBe(MARTIAN_COLOR[k]);
  });

  it('stays still while frozen, and a Builder raises its claws to slap', () => {
    const g = parts(Kind.Goopling);
    const before = g.tentacles.map((t) => t.rotation.z);
    animateMartian(Kind.Goopling, g, 1.3, 0, true, true);
    expect(g.tentacles.map((t) => t.rotation.z)).toEqual(before);
    const b = parts(Kind.Builder);
    animateMartian(Kind.Builder, b, 1, 0, false, false, 0.5);
    expect(b.claws[0].rotation.x).toBeLessThan(-0.5);
    animateMartian(Kind.Builder, b, 1, 0, false, false, 0);
    expect(b.claws[0].rotation.x).toBeCloseTo(0, 5);
  });
});

describe('low-poly bosses', () => {
  it('builds each boss and pulses brighter during a warning', () => {
    for (const k of [BossKind.GooplingHive, BossKind.DarknessHive, BossKind.MazeMaster]) {
      const p = makeBoss(k);
      expect(p.root.children.length).toBeGreaterThan(1);
      animateBoss(k, p, 1, 1, false);
      const calm = p.glow.emissiveIntensity;
      animateBoss(k, p, 1, 1, true);
      expect(p.glow.emissiveIntensity).toBeGreaterThan(calm);
    }
    expect(makeBoss(BossKind.DarknessHive).arcs.length).toBeGreaterThan(0);
    expect(makeBoss(BossKind.MazeMaster).blocks).toHaveLength(4);
  });
});
