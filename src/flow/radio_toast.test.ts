import { describe, expect, it } from 'vitest';
import { BossKind, Item } from '../sim/constants';
import { createGame } from '../sim/state';
import { RADIO, RADIO_POWERUP } from './radio_lines';
import { QUEUE_MAX, ToastQueue, toastFor } from './radio_toast';
import { t } from '../utils/i18n';

const line = (key: string) => ({ key });

describe('radio toast queue', () => {
  it('plays lines in order', () => {
    const q = new ToastQueue();
    q.push(line('a'));
    q.push(line('b'));
    expect(q.next()?.key).toBe('a');
    expect(q.next()?.key).toBe('b');
    expect(q.next()).toBeUndefined();
  });

  it('holds at most 3: the oldest goes', () => {
    const q = new ToastQueue();
    for (const t of ['a', 'b', 'c', 'd']) q.push(line(t));
    expect(QUEUE_MAX).toBe(3);
    expect(q.items.map((l) => l.key)).toEqual(['b', 'c', 'd']);
  });

  it('drops an older copy of the same line', () => {
    const q = new ToastQueue();
    for (const t of ['a', 'b', 'a']) q.push(line(t));
    expect(q.items.map((l) => l.key)).toEqual(['b', 'a']);
  });
});

describe('radio toast triggers', () => {
  const never = () => false;
  const always = () => true;

  it('gate open on normal levels only', () => {
    expect(toastFor({ type: 'gate_opened' }, createGame(1), 0, never)).toBe(RADIO.gateOpen);
    expect(toastFor({ type: 'gate_opened' }, createGame(1, { boss: BossKind.GooplingHive }), 0, never)).toBeNull();
  });

  it('last heart and vest hits: the local player only', () => {
    const g = createGame(1);
    g.players[0].lives = 1;
    expect(toastFor({ type: 'player_died', id: 0, tx: 0, ty: 0 }, g, 0, never)).toBe(RADIO.lastHeart);
    g.players[0].lives = 2;
    expect(toastFor({ type: 'player_died', id: 0, tx: 0, ty: 0 }, g, 0, never)).toBeNull();
    expect(toastFor({ type: 'armor_hit', id: 0 }, g, 0, never)).toBe(RADIO.vestHit);
    expect(toastFor({ type: 'armor_hit', id: 1 }, g, 0, never)).toBeNull();
  });

  it('the final boss wave only', () => {
    const g = createGame(1, { boss: BossKind.GooplingHive });
    expect(toastFor({ type: 'boss_wave', wave: 3 }, g, 0, never)).toBe(RADIO.lastWave);
    expect(toastFor({ type: 'boss_wave', wave: 2 }, g, 0, never)).toBeNull();
  });

  it('a power-up toast only after its intro card has been seen', () => {
    const g = createGame(1);
    const pick = { type: 'item_picked' as const, id: 0, item: Item.FreezePulse, tx: 0, ty: 0 };
    expect(toastFor(pick, g, 0, never)).toBeNull();
    expect(toastFor(pick, g, 0, always)).toBe(RADIO_POWERUP[Item.FreezePulse]);
    expect(toastFor({ ...pick, id: 1 }, g, 0, always)).toBeNull();
  });

  it('lines are Kit on the radio, short enough for one line, and never say "bomb"', () => {
    for (const l of [...Object.values(RADIO), ...Object.values(RADIO_POWERUP)]) {
      const text = t(l!.key);
      expect(text.startsWith('Kit: ')).toBe(true);
      expect(text.length).toBeLessThanOrEqual(52);
      expect(text.toLowerCase()).not.toContain('bomb');
    }
  });
});
