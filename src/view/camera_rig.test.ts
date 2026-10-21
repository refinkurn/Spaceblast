import { describe, expect, it } from 'vitest';
import { CameraRig, SHAKE_END, blastShake, shakeOffset } from './camera_rig';

describe('impact shake', () => {
  it('is strongest next to you and gone from 7 tiles away', () => {
    expect(blastShake(0)).toBe(1);
    expect(blastShake(1)).toBeCloseTo(6 / 7);
    expect(blastShake(3.5)).toBeCloseTo(0.5);
    expect(blastShake(7)).toBe(0);
    expect(blastShake(12)).toBe(0);
  });

  it('decays and is over within 0.25 s', () => {
    const peak = Math.max(...Array.from({ length: 10 }, (_, i) => Math.abs(shakeOffset(1, i / 600))));
    const late = Math.max(...Array.from({ length: 10 }, (_, i) => Math.abs(shakeOffset(1, 0.2 + i / 600))));
    expect(late).toBeLessThan(peak * 0.1);
    expect(shakeOffset(1, SHAKE_END)).toBe(0);
    expect(SHAKE_END).toBeLessThanOrEqual(0.25);
  });

  it('puts the camera back exactly where it was, and does nothing when switched off', () => {
    const rig = new CameraRig();
    rig.fit(740, 360, 120, 120, 44, 0);
    rig.update(1 / 60);
    const rest = rig.camera.position.clone();
    rig.shake(1);
    rig.update(1 / 60);
    rig.update(1 / 60);
    expect(rig.camera.position.distanceTo(rest)).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) rig.update(1 / 60);
    expect(rig.camera.position.distanceTo(rest)).toBe(0);
    rig.shakeOn = false;
    rig.shake(1);
    rig.update(1 / 60);
    rig.update(1 / 60);
    expect(rig.camera.position.distanceTo(rest)).toBe(0);
  });

  it('several blasts in one frame: the strongest counts, they do not add up', () => {
    const a = new CameraRig(), b = new CameraRig();
    for (const r of [a, b]) r.fit(740, 360, 120, 120, 44, 0);
    a.shake(0.3);
    a.shake(0.8);
    a.shake(0.5);
    b.shake(0.8);
    a.update(1 / 60); b.update(1 / 60);
    a.update(1 / 60); b.update(1 / 60);
    expect(a.camera.position.distanceTo(b.camera.position)).toBe(0);
  });
});
