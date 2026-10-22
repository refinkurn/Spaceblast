import SECTORS from '../config/sectors.json';

// Each Story sector's look, from src/config/sectors.json: the Story map's
// colours and the 3D arena's (sky, ground, floor, rocks, pillars, walls, edge
// props). Looks only: names and story text stay in flow/story.ts, rules in
// sim/levels.ts. Battle and online rounds use sector 1.

export type PropKind = 'landing_gear' | 'solar_panel' | 'dust_rock' | 'gantry' | 'floodlight' | 'hazard_plank' | 'crystal' | 'drill_rig' | 'vat' | 'alarm_bar';

export interface ArenaLook {
  background: number;
  ground: number;
  floorA: number;
  floorB: number;
  rock: number;
  pillar: number;
  wall: number;
  collapse: number;
  skyLight: number;
  groundLight: number;
}

export interface SectorLook {
  id: string;
  /** The Story map backdrop shape (map_layout.ts MapTheme). */
  mapTheme: string;
  palette: { primary: string; secondary: string; accent: string };
  /** Story map colours (CSS). */
  map: { sky: string; skyLow: string; ground: string; groundDeep: string; trail: string; deco: string };
  arena: ArenaLook;
  props: PropKind[];
}

const hex = (s: string): number => {
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new Error(`sectors.json: bad colour ${s}`);
  return parseInt(s.slice(1), 16);
};

type RawSector = Omit<SectorLook, 'arena' | 'props'> & { arena: Record<keyof ArenaLook, string>; props: string[] };

export const SECTOR_LOOKS: readonly SectorLook[] = (SECTORS.sectors as RawSector[]).map((s) => ({
  ...s,
  arena: Object.fromEntries(Object.entries(s.arena).map(([k, v]) => [k, hex(v)])) as unknown as ArenaLook,
  props: s.props as PropKind[],
}));

/** The look for 1-based `sector` (out of range: sector 1). */
export function sectorLook(sector: number): SectorLook {
  return SECTOR_LOOKS[sector - 1] ?? SECTOR_LOOKS[0];
}
