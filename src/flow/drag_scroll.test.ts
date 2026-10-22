import { describe, expect, it } from 'vitest';
import { wheelScroll } from './drag_scroll';

describe('sideways strip scrolling with a mouse', () => {
  it('a normal (vertical) wheel turn scrolls the strip sideways', () => {
    expect(wheelScroll(0, 0, 100)).toBe(100);
    expect(wheelScroll(100, 0, -40)).toBe(60);
  });

  it('a sideways wheel or trackpad swipe keeps its own direction', () => {
    expect(wheelScroll(50, 30, 5)).toBe(80);
  });
});
