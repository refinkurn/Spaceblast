import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bubbleOpacity, SpeedTrail, TRAIL_SEGMENTS, trailLife } from './speed_trail';

describe('speed trail', () => {
  const at = new THREE.Vector3();
  it('shows only while moving and fades out when standing still', () => {
    const t = new SpeedTrail();
    for (let i = 0; i < 30; i++) t.update(0.016, at, true, 2);
    expect(t.visible).toBeGreaterThan(0);
    expect(t.visible).toBeLessThanOrEqual(TRAIL_SEGMENTS);
    for (let i = 0; i < 60; i++) t.update(0.016, at, false, 2);
    expect(t.visible).toBe(0);
  });
  it('is longer with more boots', () => {
    expect(trailLife(5)).toBeGreaterThan(trailLife(1));
  });
  it('vest bubble gets brighter with armor up to 3', () => {
    expect(bubbleOpacity(2)).toBeGreaterThan(bubbleOpacity(1));
    expect(bubbleOpacity(3)).toBeGreaterThan(bubbleOpacity(2));
    expect(bubbleOpacity(5)).toBe(bubbleOpacity(3));
  });
});
