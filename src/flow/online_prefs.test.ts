import { describe, expect, it } from 'vitest';
import { chooseOnlineName } from './online_prefs';

describe('chooseOnlineName', () => {
  it('uses the CrazyGames account name when there is one', () => {
    expect(chooseOnlineName('Zoe', 'Typed')).toBe('Zoe');
  });
  it('falls back to the typed / saved name when logged out', () => {
    expect(chooseOnlineName(null, 'Typed')).toBe('Typed');
    expect(chooseOnlineName(null, '')).toBe('');
  });
});
