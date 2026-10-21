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

  it('keeps the standing sprite above the banner and Skip at least 64x48', () => {
    expect(rule('.cut-sprite')).toContain('bottom: calc(92px');
    const skip = rule('#cut-skip');
    expect(skip).toContain('min-width: 64px');
    expect(skip).toContain('min-height: 48px');
  });
});
