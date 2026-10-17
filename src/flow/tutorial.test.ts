import { describe, expect, it } from 'vitest';
import { withControls } from './tutorial';
import { BATTLE_TIPS, BEATS, TIPS } from './tutorial_script';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('tutorial script', () => {
  it('follows the guide: prompts up to 15 words, tips up to 20', () => {
    for (const b of BEATS) expect(words(b.prompt), b.id).toBeLessThanOrEqual(15);
    for (const t of [...TIPS, ...BATTLE_TIPS]) expect(words(t), t).toBeLessThanOrEqual(20);
  });

  it('has unique step ids, and steps that wait on the previous one follow a step of the same level', () => {
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(BEATS.length);
    BEATS.forEach((b, i) => {
      if (b.trigger === 'after_previous' || b.trigger === 'near_target') expect(BEATS[i - 1]?.level).toBe(b.level);
    });
  });

  it('fills in the player\'s own controls', () => {
    expect(withControls('Move with [MOVE], drop with [CHARGE].', false)).toBe('Move with the arrow keys, drop with Space.');
    expect(withControls('Press [CHARGE].', true)).toBe('Press the CHARGE button.');
    for (const b of BEATS) expect(withControls(b.prompt, true)).not.toMatch(/\[[A-Z]+\]/);
  });
});
