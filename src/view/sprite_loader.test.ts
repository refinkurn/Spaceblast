import { describe, expect, it } from 'vitest';
import { allCharacters, characterMeta, frameAt, resolvePose } from './sprite_loader';

describe('character sprites', () => {
  it('loads every character sheet description, with sane poses and size', () => {
    const all = allCharacters();
    expect(all.map((c) => c.character).sort()).toEqual(
      ['astropaw', 'captain-kit', 'darkness-hive', 'ducking', 'goopling-hive', 'maze-master'],
    );
    for (const c of all) {
      const poses = Object.values(c.poses);
      expect(poses.length).toBeGreaterThan(0);
      // One row per pose, and the whole sheet stays at 512 x 512 or less.
      expect(new Set(poses.map((p) => p.row)).size).toBe(poses.length);
      const cols = Math.max(...poses.map((p) => p.frames));
      const rows = Math.max(...poses.map((p) => p.row)) + 1;
      expect(cols * c.frameWidth).toBeLessThanOrEqual(512);
      expect(rows * c.frameHeight).toBeLessThanOrEqual(512);
      for (const p of poses) expect(p.frames >= 1 && p.duration > 0).toBe(true);
    }
  });

  it('falls back to neutral, then to the first pose', () => {
    const kit = characterMeta('captain-kit')!;
    expect(resolvePose(kit, 'worried')).toBe('worried');
    expect(resolvePose(kit, 'dancing')).toBe('neutral');
    expect(resolvePose(kit, undefined)).toBe('neutral');
    const hive = characterMeta('goopling-hive')!;
    expect(resolvePose(hive, 'neutral')).toBe('idle');
  });

  it('loops through a pose frames over time', () => {
    const kit = characterMeta('captain-kit')!;
    const row = kit.poses.worried.row;
    expect(frameAt(kit, 'worried', 0)).toEqual({ row, col: 0 });
    expect(frameAt(kit, 'worried', 250)).toEqual({ row, col: 2 });
    expect(frameAt(kit, 'worried', 450)).toEqual({ row, col: 0 });
  });
});
