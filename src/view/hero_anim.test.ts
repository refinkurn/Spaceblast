import { describe, expect, it } from 'vitest';
import { ARM_SWING, HURT_SECONDS, HeroAnimator, LEG_SWING, RUN_LEAN, SQUASH, breathe, hurtAt, runLimbs, squashAmount, squashScale } from './hero_anim';

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

describe('astronaut limbs', () => {
  const run = (a: HeroAnimator, frames: number, speed = 4) => {
    let pose = a.step(1 / 60, true, speed);
    for (let i = 1; i < frames; i++) pose = a.step(1 / 60, true, speed);
    return pose;
  };

  it('swings legs opposite each other and each arm against its same-side leg', () => {
    for (let phase = 0; phase < 6.3; phase += 0.1) {
      const l = runLimbs(phase, 1);
      expect(l.legL).toBeCloseTo(-l.legR, 10);
      expect(l.armL).toBeCloseTo(-l.armR, 10);
      expect(l.legL * l.armL).toBeLessThanOrEqual(1e-12);
    }
  });

  it('stays within +-35 degrees for legs and +-25 for arms while running', () => {
    const a = new HeroAnimator();
    for (let i = 0; i < 240; i++) {
      const p = a.step(1 / 60, true, 5);
      expect(Math.abs(p.legL)).toBeLessThanOrEqual(LEG_SWING + 1e-9);
      expect(Math.abs(p.armR)).toBeLessThanOrEqual(ARM_SWING + 1e-9);
    }
  });

  it('cycles faster with more speed, and is already swinging within about 80 ms', () => {
    const crossings = (speed: number): number => {
      const a = new HeroAnimator();
      let n = 0;
      let prev = 0;
      for (let i = 0; i < 120; i++) {
        const v = a.step(1 / 60, true, speed).legL;
        if (prev < 0 && v >= 0) n++;
        prev = v;
      }
      return n;
    };
    expect(crossings(8)).toBeGreaterThan(crossings(3));
    expect(Math.abs(run(new HeroAnimator(), 5, 6).armL)).toBeGreaterThan(0.05);
  });

  it('returns to rest when stopping', () => {
    const a = new HeroAnimator();
    run(a, 30);
    let pose = a.step(1 / 60, false, 0);
    for (let i = 0; i < 60; i++) pose = a.step(1 / 60, false, 0);
    expect(pose.legL).toBeCloseTo(0, 2);
    expect(pose.armL).toBeCloseTo(0, 2);
    expect(pose.armR).toBeCloseTo(0, 2);
  });

  it('puts the arms forward to place a charge, then lets them go', () => {
    const a = new HeroAnimator();
    a.squash();
    let top = 0;
    for (let i = 0; i < 6; i++) top = Math.max(top, a.step(1 / 60, false).armL);
    expect(top).toBeGreaterThan(1);
    let pose = a.step(1 / 60, false);
    for (let i = 0; i < 20; i++) pose = a.step(1 / 60, false);
    expect(pose.armL).toBeCloseTo(0, 2);
  });

  it('throws the arms up when hurt and when celebrating, then drops them', () => {
    const a = new HeroAnimator();
    a.hurt();
    let top = 0;
    for (let i = 0; i < 10; i++) top = Math.max(top, a.step(1 / 60, false).armL);
    expect(top).toBeGreaterThan(2);
    let pose = a.step(1 / 60, false);
    for (let i = 0; i < 40; i++) pose = a.step(1 / 60, false);
    expect(pose.armL).toBeCloseTo(0, 2);
    a.celebrating = true;
    for (let i = 0; i < 30; i++) pose = a.step(1 / 60, false);
    expect(pose.armR).toBeGreaterThan(2.5);
  });
});
