import { describe, expect, it } from 'vitest';
import { RESERVED, colorsClash } from './play_colors';
import { MAP_SECTORS } from '../flow/map_layout';
import { GRID_H, GRID_W } from '../sim/constants';
import { SECTOR_LOOKS, sectorLook } from './sector_look';
import { propSlots } from './sector_props';

/** WCAG relative luminance of a 0xRRGGBB colour. */
function luminance(c: number): number {
  const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: number, b: number) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('sector looks (src/config/sectors.json)', () => {
  it('has the four sectors with the spec ids and palettes', () => {
    expect(SECTOR_LOOKS.map((s) => s.id)).toEqual([
      'sector_1_outpost_surface',
      'sector_2_deep_shafts',
      'sector_3_tectonic_core',
      'sector_4_rogue_facility',
    ]);
    expect(SECTOR_LOOKS.map((s) => [s.palette.primary, s.palette.secondary, s.palette.accent])).toEqual([
      ['#C84B31', '#EC9B3B', '#FFE3A1'],
      ['#2D3748', '#DD6B20', '#D69E2E'],
      ['#00F5FF', '#2A085C', '#10B981'],
      ['#E2E8F0', '#22C55E', '#EF4444'],
    ]);
  });

  it('keeps each sector on its Story map backdrop shape', () => {
    expect(SECTOR_LOOKS.map((s) => s.mapTheme)).toEqual(MAP_SECTORS.map((m) => m.theme));
  });

  it('keeps the arena readable: rocks and pillars stand out from the floor and from each other', () => {
    for (const s of SECTOR_LOOKS) {
      const a = s.arena;
      expect(contrast(a.rock, a.floorA), `${s.id} rock vs floor`).toBeGreaterThan(1.3);
      expect(contrast(a.pillar, a.floorA), `${s.id} pillar vs floor`).toBeGreaterThan(1.3);
      expect(contrast(a.rock, a.pillar), `${s.id} rock vs pillar`).toBeGreaterThan(1.3);
      // The floor checker is two close shades, not a loud pattern.
      expect(contrast(a.floorA, a.floorB), `${s.id} checker`).toBeLessThan(1.35);
    }
  });

  it('never paints the floor or rocks like a blast, a Martian, a warning or the open gate', () => {
    for (const s of SECTOR_LOOKS) {
      for (const surface of ['floorA', 'floorB', 'rock'] as const) {
        for (const [name, color] of Object.entries(RESERVED)) {
          expect(colorsClash(s.arena[surface], color), `${s.id} ${surface} looks like ${name}`).toBe(false);
        }
      }
    }
  });

  it('flags look-alikes (the check itself)', () => {
    expect(colorsClash(0x3a1478, 0xa66bff)).toBe(true); // violet floor vs Sniffer
    expect(colorsClash(0xe2e8f0, 0xe9fbff)).toBe(true); // white floor vs beam core
    expect(colorsClash(0x1d2c38, 0xa66bff)).toBe(false);
  });

  it('gives every sector props of known kinds, standing outside the arena walls', () => {
    const known = ['landing_gear', 'solar_panel', 'dust_rock', 'gantry', 'floodlight', 'hazard_plank', 'crystal', 'drill_rig', 'vat', 'alarm_bar'];
    for (const s of SECTOR_LOOKS) {
      expect(s.props.length, s.id).toBeGreaterThan(0);
      for (const k of s.props) expect(known, `${s.id} ${k}`).toContain(k);
    }
    for (const [x, z] of propSlots()) {
      expect(Math.abs(x) > GRID_W / 2 + 1 || Math.abs(z) > GRID_H / 2 + 1, `${x},${z}`).toBe(true);
    }
  });

  it('falls back to sector 1 out of range (Battle and online use it)', () => {
    expect(sectorLook(0).id).toBe('sector_1_outpost_surface');
    expect(sectorLook(9).id).toBe('sector_1_outpost_surface');
  });
});
