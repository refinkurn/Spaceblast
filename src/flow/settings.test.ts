import { afterEach, describe, expect, it, vi } from 'vitest';
import { floatingCenter, restPosition } from '../input/stick_geometry';
import { loadSettings } from './settings';

const store = (data: string | null) => vi.stubGlobal('localStorage', { getItem: () => data, setItem: () => {} });
afterEach(() => vi.unstubAllGlobals());

describe('settings load', () => {
  it('defaults: floating joystick, vibration on', () => {
    store(null);
    expect(loadSettings()).toMatchObject({ joystick: 'floating', vibration: true, controls: 'normal', music: 70, sfx: 90 });
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

  it('fixed: the base rests bottom-left of the gutter above the safe area', () => {
    const rest = restPosition('fixed', 56);
    expect(rest.left).toBe('50%');
    expect(rest.top).toContain('100%');
    expect(rest.top).toContain('safe-area-inset-bottom');
    expect(restPosition('floating', 56).top).toBe('62%');
  });
});
