// Online, the room server's frames arrive unevenly: some screen frames run no
// tick, some run two, and the tick-to-tick interpolation restarts each time.
// Drawn straight, astronauts stop, jump and snap back a little several times a
// second (it looks like shaking). The view instead glides the drawn position
// towards where the sim says it is, over a few hundredths of a second, and
// jumps straight there for a teleport (respawn, warp). View only: the sim and
// every hit test keep the exact positions.

/** How quickly the drawn position catches up (seconds to close ~63% of the gap). Others / your own astronaut. */
export const GLIDE_SECONDS = 0.045;
export const GLIDE_SECONDS_YOU = 0.03;
/** Further than this (world units, 1 = a tile) is a teleport: no glide. */
export const SNAP_DISTANCE = 1.5;

/** The share of the remaining gap to close this frame. */
export function glideFactor(dt: number, seconds: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-dt / seconds);
}

/** One axis of the glide: the next drawn value. */
export function glide(shown: number, target: number, dt: number, seconds = GLIDE_SECONDS): number {
  return shown + (target - shown) * glideFactor(dt, seconds);
}
