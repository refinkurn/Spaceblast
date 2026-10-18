import { describe, expect, it } from 'vitest';
import { allCharacters, bodyFrame, characterMeta, portraitFrame, resolvePose } from './sprite_loader';

const ATLASES = import.meta.glob<{ meta: { image: string; size?: { w: number; h: number } }; frames: Record<string, { x: number; y: number; w: number; h: number }>; animations?: Record<string, { frames: string[]; fps: number }> }>(
  '../assets/characters/*/*_atlas.json', { eager: true, import: 'default' },
);

describe('character art', () => {
  it('finds every character manifest', () => {
    expect(allCharacters().map((c) => c.id).sort()).toEqual(
      ['astropaw', 'captain-kit', 'capybara', 'darkness-hive', 'ducking', 'goopling-hive', 'maze-master'],
    );
    for (const c of allCharacters()) expect(Object.keys(c.poses).length, c.id).toBeGreaterThan(0);
  });

  it('every atlas is consistent: poses map to animations, frames exist and fit the image', () => {
    for (const c of allCharacters()) {
      if (!c.body) continue;
      const atlas = Object.entries(ATLASES).find(([p]) => p.endsWith(`/${c.id}/${c.body!.atlas}`))?.[1];
      expect(atlas, `${c.id}: ${c.body.atlas}`).toBeDefined();
      for (const [pose, anim] of Object.entries(c.poses)) {
        const a = atlas!.animations?.[anim];
        expect(a, `${c.id} pose ${pose} -> ${anim}`).toBeDefined();
        expect(a!.fps).toBeGreaterThan(0);
        for (const f of a!.frames) expect(atlas!.frames[f], `${c.id}: frame ${f}`).toBeDefined();
      }
      // Phones: 1024 px per side at most.
      const size = atlas!.meta.size;
      if (size) {
        expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(1024);
        for (const f of Object.values(atlas!.frames)) expect(f.x + f.w <= size.w && f.y + f.h <= size.h).toBe(true);
      }
      expect(bodyFrame(c.id, undefined, 0), `${c.id}: image for ${atlas!.meta.image}`).not.toBeNull();
    }
  });

  it('falls back to neutral, then to the first pose', () => {
    const kit = characterMeta('captain-kit')!;
    expect(resolvePose(kit, 'worried')).toBe('worried');
    expect(resolvePose(kit, 'dancing')).toBe('neutral');
    expect(resolvePose(kit, undefined)).toBe('neutral');
    expect(resolvePose(characterMeta('goopling-hive')!, 'neutral')).toBe('idle');
  });

  it('loops looping animations and holds the last frame of the others', () => {
    // Idle: 4 frames at 6 fps, looping.
    const idle = (ms: number) => bodyFrame('astropaw', 'neutral', ms)!.rect.x;
    expect([0, 170, 340, 510, 670].map(idle)).toEqual([0, 128, 256, 384, 0]);
    // Shocked: 2 frames at 8 fps, then holds the second.
    const shocked = (ms: number) => bodyFrame('astropaw', 'surprised', ms)!.rect.x;
    expect([0, 130, 2000].map(shocked)).toEqual([0, 128, 128]);
    // Portrait-only and placeholder characters have no body frames.
    expect(bodyFrame('captain-kit', 'worried', 0)).toBeNull();
    expect(bodyFrame('capybara', 'worried', 0)).toBeNull();
  });

  it('uses the portrait for dialogue, falling back to the neutral portrait', () => {
    expect(portraitFrame('astropaw', 'neutral')?.rect).toEqual({ x: 0, y: 0, w: 128, h: 152 });
    expect(portraitFrame('astropaw', 'surprised')?.rect).toEqual({ x: 128, y: 0, w: 128, h: 152 });
    expect(portraitFrame('captain-kit', 'angry')?.rect.x).toBe(128); // stern
    expect(portraitFrame('captain-kit', 'dancing')?.rect.x).toBe(0); // unknown pose: neutral
    expect(portraitFrame('capybara', 'neutral')).toBeNull();
  });

  it('every portrait a manifest names exists in its atlas and image', () => {
    for (const c of allCharacters()) {
      if (!c.portrait) continue;
      const atlas = Object.entries(ATLASES).find(([p]) => p.endsWith(`/${c.id}/${c.portrait!.atlas}`))?.[1];
      expect(atlas, `${c.id}: ${c.portrait.atlas}`).toBeDefined();
      for (const [pose, frame] of Object.entries(c.portrait.frames)) {
        expect(atlas!.frames[frame], `${c.id} portrait ${pose} -> ${frame}`).toBeDefined();
        expect(portraitFrame(c.id, pose), `${c.id} portrait ${pose}`).not.toBeNull();
      }
    }
  });
});
