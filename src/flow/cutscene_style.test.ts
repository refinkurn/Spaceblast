import { describe, expect, it } from 'vitest';
import css from '../style.css?raw';

const rule = (sel: string) => css.match(new RegExp(`(?:^|\n)${sel.replace(/[.#]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';

describe('story dialogue banner styles', () => {
  it('is a slim full-width banner on the bottom edge', () => {
    const box = rule('.cut-box');
    expect(box).toContain('left: 0');
    expect(box).toContain('right: 0');
    expect(box).toContain('bottom: 0');
    expect(box).toContain('min-height: 84px');
  });

  it('uses a 64 px portrait, a 13 px name and 16 px+ text', () => {
    expect(rule('.cut-portrait')).toContain('width: 64px');
    expect(rule('.cut-speaker')).toContain('font-size: 13px');
    expect(rule('.cut-text')).toContain('clamp(16px, 2.4vw, 20px)');
  });

  it('stands the sprite on the banner (full-height canvas, banner over its feet) and Skip at least 64x48', () => {
    // A canvas with height:auto keeps its own aspect ratio and ignores `bottom`:
    // the character was drawn in a short box at the top and cut off mid-air.
    const sprite = rule('.cut-sprite');
    expect(sprite).toContain('height: 100%');
    expect(sprite).not.toContain('height: auto');
    const skip = rule('#cut-skip');
    expect(skip).toContain('min-width: 64px');
    expect(skip).toContain('min-height: 48px');
  });
});

describe('level card and end-of-match card styles', () => {
  it('stacks the level card into one column (it used to spread across the screen in a row)', () => {
    expect(rule('#level-card')).toContain('flex-direction: column');
  });

  it('keeps the end-of-match buttons on screen: stats scroll inside the card, long values get a full row', () => {
    const summary = rule('.banner-summary');
    expect(summary).toContain('overflow-y: auto');
    expect(summary).toContain('min-height: 0');
    expect(css).toContain('.banner-summary .wide { grid-column: 1 / -1; }');
  });
});
