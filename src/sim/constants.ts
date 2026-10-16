// Shared simulation constants. Everything in sim/ is integer math so every
// device (and later every online peer) computes identical results.

/** Sub-units per tile. Positions are stored as integers in these units. */
export const TILE = 1000;
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const GRID_W = 13;
export const GRID_H = 11;

/** ~4 tiles per second (67 * 60 = 4020 units/s). */
export const PLAYER_SPEED = 67;

export const ROCK_DENSITY_PERCENT = 60;
/** Side of the rock-free square around each spawn corner. */
export const SPAWN_SAFE = 3;

export const Cell = { Empty: 0, Pillar: 1, Rock: 2 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export const Dir = { None: 0, Up: 1, Down: 2, Left: 3, Right: 4 } as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

/** Grid step per Dir, indexed by Dir value. Up = towards row 0. */
export const DIR_DX = [0, 0, 0, -1, 1] as const;
export const DIR_DY = [0, -1, 1, 0, 0] as const;

/** Spawn tiles for up to 4 players, one per corner. */
export const SPAWNS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [GRID_W - 1, GRID_H - 1],
  [GRID_W - 1, 0],
  [0, GRID_H - 1],
];

// --- Plasma Charges (see the design doc's gameplay section) -----------------
/** 2.5 s fuse. */
export const FUSE_TICKS = 150;
/** Beams stay dangerous for 0.5 s. */
export const BEAM_TICKS = 30;
export const START_RANGE = 2;
export const START_CHARGES = 1;
/** Time before a knocked-out astronaut warps back in. */
export const RESPAWN_TICKS = 90;

// --- Power-ups ----------------------------------------------------------------
export const Item = { None: 0, BeamRange: 1, ExtraCharge: 2, JetBoots: 3, FreezePulse: 4, OxygenVest: 5 } as const;
export type Item = (typeof Item)[keyof typeof Item];
/** 1 in N rocks hides a power-up. */
export const ITEM_ONE_IN = 6;
export const MAX_RANGE = 8;
export const MAX_CHARGES = 8;
export const MAX_BOOTS = 3;
/** +0.75 tiles/s per Jet Boots level (13 * 60 = 780 units/s). */
export const BOOTS_SPEED = 13;
export const VEST_TICKS = 600;
export const FREEZE_TICKS = 240;

// --- Martians and lives ---------------------------------------------------
export const Kind = { Goopling: 1 } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];
/** Goopling: 2 tiles/s. */
export const GOOPLING_SPEED = 33;
/** Martians spawn at least this many tiles (Manhattan) from any player spawn. */
export const MARTIAN_SPAWN_DISTANCE = 6;
/** A bite lands when centres are closer than this on both axes. */
export const BITE_REACH = 650;
export const START_LIVES = 3;
/** Invulnerability after warping back in (1.5 s). */
export const SPAWN_SHIELD_TICKS = 90;
