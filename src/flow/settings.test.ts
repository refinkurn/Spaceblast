import { afterEach, describe, expect, it, vi } from 'vitest';
import { floatingBounds, floatingCenter, restPosition } from '../input/stick_geometry';
import { loadSettings } from './settings';

const store = (data: string | null) => vi.stubGlobal('localStorage', { getItem: () => data, setItem: () => {} });
afterEach(() => vi.unstubAllGlobals());

describe('settings load', () => {
  it('defaults: floating joystick, vibration on', () => {
    store(null);
    expect(loadSettings()).toMatchObject({ joystick: 'floating', vibration: true, controls: 'normal', music: 70, sfx: 90 });
  });

  it('screen shake: on by default, kept when saved', () => {
    store(null);
    expect(loadSettings().screenShake).toBe(true);
    store(JSON.stringify({ screenShake: false }));
    expect(loadSettings().screenShake).toBe(false);
  });

  it('keeps saved joystick and vibration choices', () => {
    store(JSON.stringify({ joystick: 'fixed', vibration: false }));
    expect(loadSettings()).toMatchObject({ joystick: 'fixed', vibration: false });
  });

  it('old saves without the new fields fall back to defaults; junk is ignored', () => {
    store(JSON.stringify({ music: 10, joystick: 'wild', vibration: 'yes' }));
    expect(loadSettings()).toMatchObject({ music: 10, joystick: 'floating', vibration: true });
    store('not json');
    expect(loadSettings().joystick).toBe('floating');
  });
});

describe('joystick geometry', () => {
  const rect = { left: 0, top: 44, right: 120, bottom: 360 };

  it('floating: the base follows the thumb but stays inside the gutter', () => {
    expect(floatingCenter(rect, 56, 60, 200)).toEqual({ x: 60, y: 200 });
    expect(floatingCenter(rect, 56, 5, 355)).toEqual({ x: 56, y: 304 });
  });

  it('floating (left half): clamps to the screen edges only, so the base opens under the thumb', () => {
    const b = floatingBounds({ bottom: 414 }, 896);
    expect(b).toEqual({ left: 0, top: 0, right: 896, bottom: 414 });
    // near the zone's right edge (the middle line, next to the arena): no shift
    expect(floatingCenter(b, 56, 440, 200)).toEqual({ x: 440, y: 200 });
    // near the left screen edge and bottom: kept on screen
    expect(floatingCenter(b, 56, 4, 410)).toEqual({ x: 56, y: 358 });
  });

  it('fixed: the base rests bottom-left of the gutter above the safe area', () => {
    const rest = restPosition('fixed', 56);
    expect(rest.left).toBe('50%');
    expect(rest.top).toContain('100%');
    expect(rest.top).toContain('safe-area-inset-bottom');
    expect(restPosition('floating', 56).top).toBe('62%');
  });

  it('floating: the idle base rests in the middle of the gutter, not halfway across the wide touch zone', () => {
    const left = restPosition('floating', 56).left;
    expect(left).toContain('var(--gutter) / 2');
    expect(left).toContain('safe-area-inset-left');
    expect(left).not.toBe('50%');
  });
});
