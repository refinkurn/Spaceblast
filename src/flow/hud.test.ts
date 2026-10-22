import { describe, expect, it } from 'vitest';
import { boardLeftAt, HUD_MAX_SCALE, HUD_PANEL_W, hudScale, OXYGEN, POWER_ICONS } from './hud';
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

describe('HUD stats panel scale', () => {
  it('grows up to 30% with the room beside the board, never shrinks below the base size', () => {
    expect(HUD_MAX_SCALE).toBe(1.3);
    expect(hudScale(0)).toBe(1);
    expect(hudScale(-40)).toBe(1);
    expect(hudScale(HUD_PANEL_W)).toBe(1);
    expect(hudScale(HUD_PANEL_W * 1.15)).toBe(1.15);
    expect(hudScale(HUD_PANEL_W * 1.3)).toBe(1.3);
    expect(hudScale(1000)).toBe(1.3);
  });
});

describe('board edge under the stats panel', () => {
  const edge = { topX: 232, topY: 31, bottomX: 153, bottomY: 435 };
  it('follows the slanted left outline: further right near the top of the screen', () => {
    expect(boardLeftAt(edge, 31)).toBe(232);
    expect(boardLeftAt(edge, 435)).toBe(153);
    expect(boardLeftAt(edge, 233)).toBeCloseTo(192.5, 1);
  });
  it('clamps above and below the board', () => {
    expect(boardLeftAt(edge, 0)).toBe(232);
    expect(boardLeftAt(edge, 900)).toBe(153);
  });
});
