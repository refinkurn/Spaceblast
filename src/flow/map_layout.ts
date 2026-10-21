import { LEVEL_COUNT, sectorOf } from '../sim/levels';

// Drawing data for the Story map (docs/design/story-map.md), and nothing else:
// per sector a theme, five node positions and a little scenery, all in % of
// that sector's panel (x across, y down). Level facts (bosses, names, rosters)
// stay in sim/levels.ts and flow/story.ts.

export type MapTheme = 'surface' | 'shafts' | 'core' | 'facility';

/** A scenery piece drawn with CSS (`.map-deco.<kind>`), in % of the panel. */
export interface MapDeco {
  kind: string;
  x: number;
  y: number;
}

export interface SectorLayout {
  theme: MapTheme;
  /** Node centres, one per level; the last one is the boss (or duel) node. */
  nodes: readonly (readonly [number, number])[];
  deco: readonly MapDeco[];
}

export const LEVELS_PER_SECTOR = 5;

export const MAP_SECTORS: readonly SectorLayout[] = [
  {
    theme: 'surface',
    nodes: [[14, 66], [31, 46], [48, 68], [65, 44], [85, 58]],
    deco: [{ kind: 'ship', x: 4, y: 74 }, { kind: 'rock', x: 40, y: 30 }, { kind: 'rock', x: 74, y: 78 }],
  },
  {
    theme: 'shafts',
    nodes: [[14, 42], [31, 64], [48, 42], [65, 66], [85, 48]],
    deco: [{ kind: 'beam', x: 22, y: 20 }, { kind: 'beam', x: 57, y: 20 }, { kind: 'cart', x: 76, y: 74 }],
  },
  {
    theme: 'core',
    nodes: [[14, 62], [31, 40], [48, 62], [65, 38], [85, 56]],
    deco: [{ kind: 'crack', x: 24, y: 80 }, { kind: 'crack', x: 58, y: 24 }, { kind: 'crack', x: 90, y: 84 }],
  },
  {
    theme: 'facility',
    nodes: [[14, 46], [31, 66], [50, 46], [68, 66], [87, 52]],
    deco: [{ kind: 'hull', x: 20, y: 22 }, { kind: 'hull', x: 62, y: 20 }, { kind: 'vine', x: 40, y: 82 }],
  },
];

export interface MapNode {
  level: number;
  /** 1-based sector. */
  sector: number;
  /** 0..4 within the sector; 4 is the boss or duel node. */
  index: number;
  x: number;
  y: number;
}

/** Where `level` sits on the map. */
export function nodeOf(level: number): MapNode {
  const sector = sectorOf(level);
  const index = (level - 1) % LEVELS_PER_SECTOR;
  const [x, y] = MAP_SECTORS[sector - 1].nodes[index];
  return { level, sector, index, x, y };
}

/** Every node, level 1 to 20. */
export function mapNodes(): MapNode[] {
  return Array.from({ length: LEVEL_COUNT }, (_, i) => nodeOf(i + 1));
}

/**
 * Sectors drawn: up to the one after the current level's. That last one is
 * shown dim and locked; anything further is cut off.
 */
export function sectorsShown(unlocked: number): number {
  return Math.min(MAP_SECTORS.length, sectorOf(unlocked) + 1);
}
