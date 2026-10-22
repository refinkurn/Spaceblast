import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DUCK_SUIT, FIGURE_SCALE, buildAstronaut, setHead } from './astronaut_mesh';

const count = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

describe('astronaut figure', () => {
  it('is a small mesh count, stands on the floor and is at most 0.9 tile tall', () => {
    const f = buildAstronaut(0x3a7bff, 'corgi');
    expect(count(f.root)).toBeLessThanOrEqual(24);
    f.root.scale.setScalar(FIGURE_SCALE);
    f.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(f.root);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(box.min.y).toBeLessThan(0.05);
    expect(box.max.y).toBeLessThanOrEqual(0.92);
  });

  it('shares geometry between figures and keeps the suit colour per figure', () => {
    const a = buildAstronaut(0xff0000, 'corgi');
    const b = buildAstronaut(0x00ff00, 'corgi');
    expect(a.torso.geometry).toBe(b.torso.geometry);
    expect(a.suit).not.toBe(b.suit);
    expect(a.suit.color.getHex()).toBe(0xff0000);
  });

  it('swaps the head between corgi and duck', () => {
    const f = buildAstronaut(DUCK_SUIT, 'duck');
    const duckParts = f.head.children.length;
    setHead(f.head, 'corgi');
    expect(f.head.children.length).toBeGreaterThan(duckParts);
    setHead(f.head, 'duck');
    expect(f.head.children.length).toBe(duckParts);
  });

  it('can drop the backpack light at reduced quality', () => {
    expect(buildAstronaut(0xffffff, 'corgi', true).packLight.visible).toBe(false);
  });
});
