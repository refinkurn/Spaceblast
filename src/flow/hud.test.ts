import { describe, expect, it } from 'vitest';
import { OXYGEN, POWER_ICONS } from './hud';
import { Item } from '../sim/constants';
import { ITEM_LOOK } from '../view/item_look';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

describe('HUD power-up icons', () => {
  it('use each power-up\'s main colour', () => {
    expect(POWER_ICONS.charges).toContain(hex(ITEM_LOOK[Item.ExtraCharge].color));
    expect(POWER_ICONS.range).toContain(hex(ITEM_LOOK[Item.BeamRange].color));
    expect(POWER_ICONS.speed).toContain(hex(ITEM_LOOK[Item.JetBoots].color));
    expect(POWER_ICONS.freeze).toContain(hex(ITEM_LOOK[Item.FreezePulse].color));
    expect(OXYGEN).toContain(hex(ITEM_LOOK[Item.OxygenVest].second));
  });
});
