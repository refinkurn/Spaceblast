import { describe, expect, it } from 'vitest';
import { MuteSources } from './mute';

describe('MuteSources', () => {
  it('silent while any source asks, back when none does', () => {
    const m = new MuteSources();
    expect(m.silent).toBe(false);
    m.set('portal', true);
    expect(m.silent).toBe(true);
    m.set('portal', false);
    expect(m.silent).toBe(false);
  });

  it('ad mute and the portal setting overlapping: sound returns only when both are off', () => {
    const m = new MuteSources();
    m.set('ad', true);
    m.set('portal', true);
    m.set('ad', false); // the ad ended, the setting still asks for silence
    expect(m.silent).toBe(true);
    m.set('ad', true);
    m.set('portal', false); // the setting lifted during an ad
    expect(m.silent).toBe(true);
    m.set('ad', false);
    expect(m.silent).toBe(false);
  });

  it('repeating a state changes nothing', () => {
    const m = new MuteSources();
    m.set('ad', true);
    m.set('ad', true);
    m.set('ad', false);
    expect(m.silent).toBe(false);
  });
});
