// Deterministic xorshift32. Never use Math.random() inside sim/: the RNG
// state lives in GameState so a seed + inputs always replay identically.

export interface RngState {
  rng: number;
}

/** Scrambles the seed (a 32-bit integer hash) so nearby seeds give unrelated sequences. */
export function seedRng(seed: number): number {
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x7feb352d);
  s = Math.imul(s ^ (s >>> 15), 0x846ca68b);
  s = (s ^ (s >>> 16)) >>> 0;
  return s === 0 ? 0x9e3779b9 : s;
}

/** Returns an unsigned 32-bit integer and advances the state. */
export function nextU32(state: RngState): number {
  let x = state.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng;
}

/** Integer in [0, n). */
export function nextInt(state: RngState, n: number): number {
  return nextU32(state) % n;
}
