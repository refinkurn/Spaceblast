import { describe, expect, it } from 'vitest';
import { HURT_SECONDS, HeroAnimator, RUN_LEAN, SQUASH, breathe, hurtAt, squashAmount, squashScale } from './hero_anim';

describe('astronaut juice', () => {
  it('squashes to 0.75 tall / 1.15 wide and is back to normal after 120 ms', () => {
    expect(squashScale(squashAmount(0))).toEqual({ y: 0.75, xz: 1.15 });
    expect(squashAmount(SQUASH.seconds / 2)).toBeGreaterThan(0);
    expect(squashScale(squashAmount(SQUASH.seconds))).toEqual({ y: 1, xz: 1 });
  });

  it('shakes and flashes for 200 ms, then stops exactly', () => {
    expect(hurtAt(0).flash).toBe(1);
    expect(Math.abs(hurtAt(0.05).offset)).toBeLessThanOrEqual(0.07);
    expect(hurtAt(HURT_SECONDS)).toEqual({ offset: 0, flash: 0 });
  });

  it('breathes gently', () => {
    for (let t = 0; t < 3; t += 0.1) expect(Math.abs(breathe(t).y)).toBeLessThanOrEqual(0.012);
  });

  it('leans forward while running and settles back when stopping; timers end', () => {
    const a = new HeroAnimator();
    let pose = a.step(0, false);
    for (let i = 0; i < 30; i++) pose = a.step(1 / 60, true);
    expect(pose.lean).toBeCloseTo(RUN_LEAN, 2);
    for (let i = 0; i < 60; i++) pose = a.step(1 / 60, false);
    expect(pose.lean).toBeLessThan(0.01);
    a.squash();
    a.hurt();
    expect(a.step(1 / 60, false).scaleY).toBeLessThan(1);
    for (let i = 0; i < 20; i++) pose = a.step(1 / 60, false);
    expect(pose.scaleY).toBe(1);
    expect(pose.flash).toBe(0);
    expect(pose.shake).toBe(0);
  });
});
