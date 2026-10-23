import { GRID_H, GRID_W, ROCK_DENSITY_PERCENT } from './constants';
import { seedRng } from './rng';

// Arena layouts: where the pillars stand and how many rocks are rolled. Every
// layout is 13x11 and mirror-symmetric on both axes, so the four spawn corners
// are equally fair. Story levels use their sector's layout (levels.ts: arena =
// sector); Battle and online pick one (online: RoomSettings.arena).
//
// Rules every layout keeps (arenas.test.ts checks them over many seeds):
//   - every non-pillar tile reaches every spawn (rocks count, they can be blasted)
//   - the spawn tile and its neighbours are never pillars; no rock in the spawn zone
//   - BOSS_TILE and its 4 neighbours are never pillars (layouts 1-4: boss levels use them)
//   - no 2x2 block of pillars; 23-37 pillars (today's 30, +-25%)
//
// '#' = pillar, '.' = floor (rocks are rolled on floor outside the spawn zones).

export interface ArenaLayout {
  id: number;
  /** Stable key for interface text (e.g. t(`arena.${key}`)) and logs. */
  key: string;
  /** Chance (in %) that a floor tile outside the spawn zones starts as a rock. */
  rockDensity: number;
  rows: readonly string[];
}

export const ARENAS: readonly ArenaLayout[] = [
  {
    // 0 Classic: the original pillar on every odd/odd tile.
    id: 0, key: 'classic', rockDensity: ROCK_DENSITY_PERCENT,
    rows: [
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
    ],
  },
  {
    // 1 Duststorm Valley, open dunes: the sparsest layout, a wide open basin in
    // the middle and fewer rocks. Beginner-friendly.
    id: 1, key: 'dunes', rockDensity: 50,
    rows: [
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
      '.#.#.....#.#.',
      '.............',
      '.#.#.....#.#.',
      '.............',
      '.#.#.....#.#.',
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
    ],
  },
  {
    // 2 Abandoned Mining Colony, mine corridors: support beams join pillars into
    // runs (rows 3 and 7) and side shafts (columns 1 and 11), gaps between them.
    id: 2, key: 'mines', rockDensity: 60,
    rows: [
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
      '.#.###.###.#.',
      '.#.........#.',
      '.#.#.....#.#.',
      '.#.........#.',
      '.#.###.###.#.',
      '.............',
      '.#.#.#.#.#.#.',
      '.............',
    ],
  },
  {
    // 3 Crystal Core, crystal clusters: four crystal crosses, shards on the
    // centre column, a ring of crystals around the core; open lanes between.
    id: 3, key: 'crystals', rockDensity: 55,
    rows: [
      '.............',
      '......#......',
      '...#..#..#...',
      '..###...###..',
      '...#.#.#.#...',
      '.#.........#.',
      '...#.#.#.#...',
      '..###...###..',
      '...#..#..#...',
      '......#......',
      '.............',
    ],
  },
  {
    // 4 Underground Bio-Lab, lab rooms: a wall down the middle column and across
    // the middle row split the arena into 4 rooms; doorways at the edges, at
    // rows 2 and 8, and through the open centre (4 per room).
    id: 4, key: 'lab', rockDensity: 55,
    rows: [
      '......#......',
      '.#.#..#..#.#.',
      '.............',
      '.#.#.###.#.#.',
      '.............',
      '.####...####.',
      '.............',
      '.#.#.###.#.#.',
      '.............',
      '.#.#..#..#.#.',
      '......#......',
    ],
  },
];

/** Layouts a room or Battle can choose (classic stays for tests and old rounds). */
export const ARENA_IDS: readonly number[] = [1, 2, 3, 4];
export const CLASSIC_ARENA = 0;
export type ArenaChoice = number | 'random';

/** Pillars per layout as a flat array (y * GRID_W + x), built once. */
const PILLARS: readonly Uint8Array[] = ARENAS.map((a) => {
  const out = new Uint8Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) out[y * GRID_W + x] = a.rows[y][x] === '#' ? 1 : 0;
  return out;
});

export function isArenaId(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < ARENAS.length;
}

export function arenaLayout(id: number): ArenaLayout {
  return ARENAS[isArenaId(id) ? id : CLASSIC_ARENA];
}

/** Does layout `id` put a pillar on (x, y)? */
export function arenaPillar(id: number, x: number, y: number): boolean {
  return PILLARS[isArenaId(id) ? id : CLASSIC_ARENA][y * GRID_W + x] === 1;
}

/**
 * The layout a game is built on. 'random' picks one of ARENA_IDS from the
 * round seed alone (not the game RNG), so every browser in a room gets the same
 * grid with nothing extra on the wire. Anything else invalid means classic.
 */
export function resolveArena(choice: ArenaChoice | undefined, seed: number): number {
  if (choice === 'random') return ARENA_IDS[seedRng((seed ^ 0x6a2e1f37) >>> 0) % ARENA_IDS.length];
  return isArenaId(choice) ? choice : CLASSIC_ARENA;
}
