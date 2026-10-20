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
/**
 * A beam lasts BEAM_TICKS; it is dangerous for its first 0.5 s, then fades out
 * harmlessly for BEAM_FADE_TICKS, so a beam that looks finished is safe to walk into.
 */
export const BEAM_FADE_TICKS = 10;
export const BEAM_TICKS = 30 + BEAM_FADE_TICKS;
export const START_RANGE = 1;
export const START_CHARGES = 1;
/** Time before a knocked-out astronaut warps back in. */
export const RESPAWN_TICKS = 90;

// --- Power-ups ----------------------------------------------------------------
export const Item = { None: 0, BeamRange: 1, ExtraCharge: 2, JetBoots: 3, FreezePulse: 4, OxygenVest: 5 } as const;
export type Item = (typeof Item)[keyof typeof Item];
/** 1 in N rocks hides a power-up. */
export const ITEM_ONE_IN = 6;
export const MAX_RANGE = 5;
export const MAX_CHARGES = 5;
/** Speed Boost steps (the item is still called JetBoots in code). */
export const MAX_BOOTS = 5;
/** +0.54 tiles/s per Speed Boost step (9 * 60 = 540 units/s); 5 steps is about 6.7 tiles/s. */
export const BOOTS_SPEED = 9;
/** Oxygen Vest: each one is an armor point that absorbs one hit, up to this many. */
export const MAX_ARMOR = 3;
/** Freeze Pulse stops every Martian for 3 s. */
export const FREEZE_TICKS = 180;

// --- Martians and lives ---------------------------------------------------
export const Kind = { Goopling: 1, Sniffer: 2, Phaser: 3, Builder: 4 } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];
/** Goopling: 2 tiles/s. */
export const GOOPLING_SPEED = 33;
/** Movement speed per Kind, in units per tick (Sniffer 3 tiles/s, Builder 1.8). */
export const MARTIAN_SPEED = [0, GOOPLING_SPEED, 50, 40, 30] as const;
/** Sniffer: notices a charge only once it has been down this long (0.6 s)... */
export const SNIFF_DELAY_TICKS = 36;
/** ...and misjudges 1 decision in this many. */
export const SNIFF_MISS_ONE_IN = 4;
/** Phaser: wanders this long, hides this long, then its portals stay open this long. */
export const PHASER_WANDER_TICKS = 300;
export const PHASER_HIDE_TICKS = 180;
export const PORTAL_TICKS = 240;
/** Builder: places a rock this often, up to this many. */
export const BUILD_EVERY_TICKS = 240;
export const BUILDER_MAX_ROCKS = 8;
/** Martians spawn at least this many tiles (Manhattan) from any player spawn. */
export const MARTIAN_SPAWN_DISTANCE = 6;
/** A bite lands when centres are closer than this on both axes. */
export const BITE_REACH = 650;
export const START_LIVES = 3;
/** Invulnerability after warping back in (1.5 s). */
export const SPAWN_SHIELD_TICKS = 90;

// --- Battle ---------------------------------------------------------------------
/** Round clock for Battle vs bot (online rooms pick one of ROUND_SECONDS). */
export const ROUND_TICKS = 2 * 60 * 60;
/** Round time choices for online rooms, in seconds. */
export const ROUND_SECONDS: readonly number[] = [60, 90, 120, 150, 180];
/**
 * When the clock runs out the arena collapses: unbreakable blocks fall one at a
 * time, spiralling in from the edge, and crush whoever stands there.
 * One block every 0.2 s: the whole arena is gone in about 25 s.
 */
export const COLLAPSE_EVERY = 12;
/** The collapse is announced 3 s ahead. */
export const COLLAPSE_WARNING_TICKS = 180;

// --- Level events (survival) ------------------------------------------------------
// Which levels have which events lives in levels.ts.
/** Every event is announced this long before it happens (3 s). */
export const EVENT_WARNING_TICKS = 180;
/** First event about 20 s into a level, then one every 25-35 s. */
export const FIRST_EVENT_TICKS = 20 * 60;
export const EVENT_GAP_MIN_TICKS = 25 * 60;
export const EVENT_GAP_MAX_TICKS = 35 * 60;
/** Sectors 3-4: high-frequency events, one every 12-18 s. */
export const EVENT_GAP_FAST_MIN_TICKS = 12 * 60;
export const EVENT_GAP_FAST_MAX_TICKS = 18 * 60;
/** Blackout lasts 10-15 s. */
export const BLACKOUT_MIN_TICKS = 600;
export const BLACKOUT_MAX_TICKS = 900;
/** Maze Shift moves this many rocks. */
export const SHIFT_MIN_ROCKS = 4;
export const SHIFT_MAX_ROCKS = 6;
/** A revealed gate nobody enters moves after 10 s, flickering for its last 3 s. */
export const GATE_WAIT_TICKS = 600;
export const GATE_FLICKER_TICKS = 180;

export const LevelEvent = { None: 0, MazeShift: 1, Blackout: 2 } as const;
export type LevelEvent = (typeof LevelEvent)[keyof typeof LevelEvent];

// --- Bosses ---------------------------------------------------------------------------
export const BossKind = { None: 0, GooplingHive: 1, DarknessHive: 2, MazeMaster: 3 } as const;
export type BossKind = (typeof BossKind)[keyof typeof BossKind];
/** beamOwner value for the boss's own blasts (Gooplings are immune to them). */
export const BOSS_OWNER = 255;
/** Bosses sit on the centre tile; it becomes solid for the fight. */
export const BOSS_TILE: readonly [number, number] = [6, 5];
/** Gooplings spouted per boss wave. */
export const BOSS_SPOUT = 3;
/** Every boss fires 3 waves; each wait is half the one before it. */
export const BOSS_WAVES = 3;
/** First wait per boss, in seconds; later bosses start faster. */
export const BOSS_FIRST_WAIT_SECONDS: Record<number, number> = {
  [BossKind.GooplingHive]: 60,
  [BossKind.DarknessHive]: 48,
  [BossKind.MazeMaster]: 40,
};
/**
 * Seconds to wait after each wave (the boss dies when the last one runs out):
 * halving each time, e.g. 60 -> 30 -> 15.
 */
export const BOSS_WAVES_SECONDS: Record<number, readonly number[]> = Object.fromEntries(
  Object.entries(BOSS_FIRST_WAIT_SECONDS).map(([kind, first]) => [
    kind,
    Array.from({ length: BOSS_WAVES }, (_, i) => first / 2 ** i),
  ]),
);
