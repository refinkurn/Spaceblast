import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// transition.ts drives a DOM overlay with timers and animation frames; here
// they are stand-ins (the tests run in Node): a fake overlay element, fake
// timers, and requestAnimationFrame on a 16 ms timer.

let classes: Set<string>;
let reduced = false;

/** A fresh copy of the module (its fade state is module-level); fake timers start after the import. */
async function load() {
  vi.resetModules();
  const mod = await import('./transition');
  vi.useFakeTimers();
  return mod;
}

beforeEach(() => {
  classes = new Set();
  reduced = false;
  const overlay = {
    id: '',
    style: {} as Record<string, string>,
    setAttribute: () => {},
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) },
  };
  vi.stubGlobal('document', { createElement: () => overlay, body: { append: () => {} } });
  // Looked up at call time, so they use the fake timers.
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }), setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms) });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('screen-change micro-fade', () => {
  it('goes dark first, swaps under the black, then lifts: about 250 ms in all', async () => {
    const { fadeThrough, fading, FADE_OUT_MS, FADE_IN_MS } = await load();
    expect(FADE_OUT_MS + FADE_IN_MS).toBeGreaterThanOrEqual(150);
    expect(FADE_OUT_MS + FADE_IN_MS).toBeLessThanOrEqual(250);
    const swap = vi.fn();
    fadeThrough(swap);
    expect(swap).not.toHaveBeenCalled();
    expect(classes.has('on')).toBe(true);
    expect(fading()).toBe(true);
    vi.advanceTimersByTime(FADE_OUT_MS);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(classes.has('on')).toBe(true); // still black while the new screen is first drawn
    vi.advanceTimersByTime(32);
    expect(classes.has('on')).toBe(false);
    vi.advanceTimersByTime(FADE_IN_MS);
    expect(fading()).toBe(false);
  });

  it('a second change while going dark joins the same black frame (one fade, in order)', async () => {
    const { fadeThrough, FADE_OUT_MS } = await load();
    const order: string[] = [];
    fadeThrough(() => order.push('a'));
    vi.advanceTimersByTime(FADE_OUT_MS / 2);
    fadeThrough(() => order.push('b'));
    vi.advanceTimersByTime(FADE_OUT_MS / 2);
    expect(order).toEqual(['a', 'b']);
  });

  it('a change started from inside a swap (map Back -> menu) runs in the same black frame', async () => {
    const { fadeThrough, FADE_OUT_MS } = await load();
    const inner = vi.fn();
    fadeThrough(() => fadeThrough(inner));
    vi.advanceTimersByTime(FADE_OUT_MS);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(classes.has('on')).toBe(true);
  });

  it('a change while lifting goes dark again before swapping', async () => {
    const { fadeThrough, FADE_OUT_MS } = await load();
    fadeThrough(() => {});
    vi.advanceTimersByTime(FADE_OUT_MS + 32 + 50);
    expect(classes.has('on')).toBe(false);
    const swap = vi.fn();
    fadeThrough(swap);
    expect(classes.has('on')).toBe(true);
    expect(swap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FADE_OUT_MS);
    expect(swap).toHaveBeenCalledTimes(1);
  });

  it('a failing swap does not leave the screen black', async () => {
    const { fadeThrough, FADE_OUT_MS, FADE_IN_MS } = await load();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    fadeThrough(() => { throw new Error('boom'); });
    fadeThrough(after);
    vi.advanceTimersByTime(FADE_OUT_MS + 32 + FADE_IN_MS);
    expect(after).toHaveBeenCalled();
    expect(classes.has('on')).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it('lifts even when no animation frames come (background tab)', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const { fadeThrough, fading, FADE_OUT_MS, FADE_IN_MS } = await load();
    fadeThrough(() => {});
    vi.advanceTimersByTime(FADE_OUT_MS + 100);
    expect(classes.has('on')).toBe(false);
    vi.advanceTimersByTime(FADE_IN_MS);
    expect(fading()).toBe(false);
  });

  it('with reduced motion the swap runs at once, no fade', async () => {
    reduced = true;
    const { fadeThrough, fading } = await load();
    const swap = vi.fn();
    fadeThrough(swap);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(classes.has('on')).toBe(false);
    expect(fading()).toBe(false);
  });
});
