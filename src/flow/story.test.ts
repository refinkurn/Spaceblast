import { describe, expect, it } from 'vitest';
import { levelSpec } from '../sim/levels';
import { levelCard } from './story';

describe('level card', () => {
  it('level 1 is 1-1 with the gate goal and a Kit line', () => {
    const c = levelCard(levelSpec(1));
    expect(c.title).toBe('1-1');
    expect(c.sector).toBe('DUSTSTORM VALLEY');
    expect(c.goal).toEqual({ icon: 'gate', text: 'Find the Warp Gate' });
    expect(c.briefing).not.toBe('');
  });

  it('numbers levels within their sector', () => {
    expect(levelCard(levelSpec(3)).title).toBe('1-3');
    expect(levelCard(levelSpec(8)).title).toBe('2-3');
    expect(levelCard(levelSpec(8)).goal.icon).toBe('gate');
  });

  it('boss levels say BOSS and ask to survive 3 waves', () => {
    const c = levelCard(levelSpec(5));
    expect(c.title).toBe('1-5 BOSS');
    expect(c.goal).toEqual({ icon: 'shield', text: 'Survive 3 waves' });
  });

  it('level 20 is the duel', () => {
    const c = levelCard(levelSpec(20));
    expect(c.title).toBe('4-5');
    expect(c.goal).toEqual({ icon: 'duel', text: 'Stun Ducking' });
  });

  it('does not carry Bosco\'s reply', () => {
    expect(levelCard(levelSpec(3))).not.toHaveProperty('reply');
  });
});
