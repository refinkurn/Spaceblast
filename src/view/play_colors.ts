import { Kind } from '../sim/constants';

// Colours that carry gameplay meaning: blasts, Martians, Maze Shift warnings,
// the Warp Gate. Sector looks (src/config/sectors.json "arena") must stay
// clearly apart from these, so a beam or a Martian never blends into the floor
// or the rocks. sector_look.test.ts checks every sector against this list.

/** Plasma beam glow and the charges' light. */
export const PLASMA = 0x5ad1ff;
/** The bright core of a beam. */
export const BEAM_CORE = 0xe9fbff;

/** Body colour per Martian kind. */
export const MARTIAN_COLOR: Record<number, number> = {
  [Kind.Goopling]: 0x6fd14f,
  [Kind.Sniffer]: 0xa66bff,
  [Kind.Phaser]: 0x7f8cff,
  [Kind.Builder]: 0xc6e33a,
};
/** A frozen Martian (Freeze Pulse). */
export const FROZEN = 0x9fd8ff;

/** Maze Shift warning: a rock about to vanish (magenta: no floor, rock or Martian uses it). */
export const WARN_REMOVE = 0xff4fd8;
/** Maze Shift warning: a rock about to appear. */
export const WARN_ADD = 0xffe25a;
/** The open Warp Gate. */
export const GATE_OPEN = 0x7dffd8;

/** Everything a sector's floor and rocks must not look like. */
export const RESERVED: Record<string, number> = {
  beam: PLASMA,
  beamCore: BEAM_CORE,
  goopling: MARTIAN_COLOR[Kind.Goopling],
  sniffer: MARTIAN_COLOR[Kind.Sniffer],
  phaser: MARTIAN_COLOR[Kind.Phaser],
  builder: MARTIAN_COLOR[Kind.Builder],
  frozen: FROZEN,
  warnRemove: WARN_REMOVE,
  gate: GATE_OPEN,
};

/** CIE Lab of a 0xRRGGBB colour (D65). */
export function toLab(hex: number): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const r = lin((hex >> 16) & 255), g = lin((hex >> 8) & 255), b = lin(hex & 255);
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * Do two colours read as "the same thing"? Too close overall (Lab distance
 * under 40), or both clearly coloured with nearly the same hue (within 28
 * degrees) and not far apart (under 75): violet on violet, green on green.
 */
export function colorsClash(a: number, b: number): boolean {
  const [l1, a1, b1] = toLab(a), [l2, a2, b2] = toLab(b);
  const d = Math.hypot(l1 - l2, a1 - a2, b1 - b2);
  if (d < 40) return true;
  const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2);
  const h = Math.abs(Math.atan2(b1, a1) - Math.atan2(b2, a2)) * (180 / Math.PI);
  const hue = Math.min(h, 360 - h);
  return c1 > 25 && c2 > 25 && hue < 28 && d < 75;
}
