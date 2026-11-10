import { describe, expect, it } from 'vitest';
import css from '../style.css?raw';
import { startsWithTouch } from './input_mode';

describe('input mode', () => {
  it('shows touch controls at start only when touch is the main pointer', () => {
    expect(startsWithTouch(true)).toBe(true);
    expect(startsWithTouch(false)).toBe(false);
  });

  it('hides the stick and Charge button for mouse-and-keyboard players', () => {
    expect(css).toMatch(/body\.no-touch #stick-zone, body\.no-touch #action-zone \{ display: none; \}/);
  });
});
