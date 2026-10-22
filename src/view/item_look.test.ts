import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Item } from '../sim/constants';
import { ITEM_KINDS, ITEM_LOOK, itemBody, SHELL_COLOR, shellMesh } from './item_look';
import { ParticlePool, POOL_SIZE } from './particles';

describe('item looks', () => {
  it('covers all five power-ups', () => {
    expect(ITEM_KINDS).toHaveLength(5);
    for (const item of ITEM_KINDS) {
      const l = ITEM_LOOK[item];
      expect(l.name).toBeTruthy();
      expect(l.color).toBeGreaterThan(0);
      expect(itemBody(item).children.length).toBeGreaterThan(0);
      expect(shellMesh(item).geometry).toBeTruthy();
    }
  });
  it('keeps the shell neutral and faint, so the item is the only colour (no glow in its colour)', () => {
    for (const item of ITEM_KINDS) {
      const m = shellMesh(item).material as THREE.MeshStandardMaterial;
      expect(m.color.getHex()).toBe(SHELL_COLOR);
      expect(m.color.getHex()).not.toBe(ITEM_LOOK[item].color);
      expect(m.emissive.getHex()).toBe(0);
      expect(m.opacity).toBeLessThanOrEqual(0.2);
    }
  });
  it('uses the game names and distinct main colours', () => {
    expect(ITEM_LOOK[Item.ExtraCharge].name).toBe('Extra Charge');
    expect(ITEM_LOOK[Item.OxygenVest].name).toBe('Oxygen Vest');
    const colors = new Set(ITEM_KINDS.map((i) => ITEM_LOOK[i].color));
    expect(colors.size).toBe(5);
  });
  it('shares geometry between copies', () => {
    const first = (g: ReturnType<typeof itemBody>) => (g.children[0] as THREE.Mesh).geometry;
    expect(first(itemBody(Item.FreezePulse))).toBe(first(itemBody(Item.FreezePulse)));
  });
});

describe('particle pool', () => {
  it('never holds more than its cap and dots expire', () => {
    const p = new ParticlePool();
    p.burst(0, 0, 0, 0xffffff, 500);
    expect(p.alive).toBeLessThanOrEqual(POOL_SIZE);
    for (let i = 0; i < 60; i++) p.update(0.05);
    expect(p.alive).toBe(0);
  });
});
