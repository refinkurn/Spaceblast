import {
  BLACKOUT_MAX_TICKS, BLACKOUT_MIN_TICKS, Cell, EVENT_GAP_FAST_MAX_TICKS, EVENT_GAP_FAST_MIN_TICKS, EVENT_GAP_MAX_TICKS,
  EVENT_GAP_MIN_TICKS, EVENT_WARNING_TICKS, GATE_WAIT_TICKS, Item, LevelEvent, SHIFT_MAX_ROCKS, SHIFT_MIN_ROCKS, TILE,
} from './constants';
import { nextInt } from './rng';
import { playerTile, type GameState } from './state';

// Survival level events: Maze Shift and Blackout (announced 3 s ahead, never
// overlapping), and the wandering Warp Gate. Bosses start events through warn().

export function updateLevelEvents(state: GameState): void {
  // Battle rooms can switch on Maze Shift and Blackout too; the gate is survival only.
  updateTimedEvent(state);
  if (state.mode === 'survival') updateGateWander(state);
}

function updateTimedEvent(state: GameState): void {
  const { rules } = state;
  if (state.event === LevelEvent.None) {
    // Running events always finish; new ones only start on levels that have them.
    if ((rules.mazeShift || rules.blackout) && --state.nextEvent <= 0) announce(state);
  } else if (state.eventWarning > 0) {
    if (--state.eventWarning === 0) begin(state);
  } else if (state.eventActive > 0) {
    if (--state.eventActive === 0) finish(state);
  }
}

/** Picks the next event (alternating when both are on) and starts its warning. */
function announce(state: GameState): void {
  const { rules } = state;
  let kind: LevelEvent = rules.mazeShift ? LevelEvent.MazeShift : LevelEvent.Blackout;
  if (rules.mazeShift && rules.blackout) kind = nextInt(state, 2) === 0 ? LevelEvent.MazeShift : LevelEvent.Blackout;
  warn(state, kind);
}

/** Announces an event now; it happens when the 3 s warning runs out. */
export function warn(state: GameState, kind: LevelEvent): void {
  state.event = kind;
  state.eventWarning = EVENT_WARNING_TICKS;
  if (kind === LevelEvent.MazeShift) planShift(state);
  state.events.push({ type: 'event_warning', event: kind });
}

function begin(state: GameState): void {
  if (state.event === LevelEvent.MazeShift) {
    applyShift(state);
    finish(state);
  } else {
    state.eventActive = BLACKOUT_MIN_TICKS + nextInt(state, BLACKOUT_MAX_TICKS - BLACKOUT_MIN_TICKS + 1);
    state.events.push({ type: 'blackout_start' });
  }
}

function finish(state: GameState): void {
  if (state.event === LevelEvent.Blackout) state.events.push({ type: 'blackout_end' });
  state.event = LevelEvent.None;
  state.eventActive = 0;
  const [lo, hi] = state.rules.frequentEvents ? [EVENT_GAP_FAST_MIN_TICKS, EVENT_GAP_FAST_MAX_TICKS] : [EVENT_GAP_MIN_TICKS, EVENT_GAP_MAX_TICKS];
  state.nextEvent = lo + nextInt(state, hi - lo + 1);
}

// --- Maze Shift ------------------------------------------------------------------

/** Is anyone (astronaut or Martian) on or right next to this tile, or is something on it? */
function busy(state: GameState, i: number): boolean {
  const { grid } = state;
  const x = i % grid.w, y = Math.floor(i / grid.w);
  if (state.items[i] !== Item.None || i === state.gate || state.beams[i] > 0) return true;
  if (state.charges.some((c) => c.tx === x && c.ty === y)) return true;
  // Astronauts get a one-tile margin so a rock never drops right onto their path.
  if (state.players.some((p) => p.alive && Math.abs(playerTile(p)[0] - x) + Math.abs(playerTile(p)[1] - y) <= 1)) return true;
  return state.martians.some((m) => m.alive && Math.abs(m.x - x * TILE) < TILE && Math.abs(m.y - y * TILE) < TILE);
}

function pick(state: GameState, from: number[], count: number): number[] {
  const pool = [...from];
  const out: number[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(nextInt(state, pool.length), 1)[0]);
  return out;
}

/** Chooses which rocks move, so the view can flash those tiles during the warning. */
function planShift(state: GameState): void {
  const { cells } = state.grid;
  const rocks: number[] = [];
  const open: number[] = [];
  cells.forEach((c, i) => {
    if (c === Cell.Rock && state.items[i] === Item.None && i !== state.gate) rocks.push(i);
    if (c === Cell.Empty && !busy(state, i)) open.push(i);
  });
  const count = SHIFT_MIN_ROCKS + nextInt(state, SHIFT_MAX_ROCKS - SHIFT_MIN_ROCKS + 1);
  state.shiftRemove = pick(state, rocks, count);
  state.shiftAdd = pick(state, open, state.shiftRemove.length);
}

/** Moves the planned rocks, re-checking each new spot (things may have moved in 3 s). */
function applyShift(state: GameState): void {
  const { cells } = state.grid;
  const removed = state.shiftRemove.filter((i) => cells[i] === Cell.Rock && i !== state.gate);
  const added = state.shiftAdd.filter((i) => cells[i] === Cell.Empty && !busy(state, i));
  for (const i of removed) cells[i] = Cell.Empty;
  for (const i of added) cells[i] = Cell.Rock;
  state.shiftRemove = [];
  state.shiftAdd = [];
  state.events.push({ type: 'maze_shift', removed, added });
}

// --- Wandering Warp Gate -----------------------------------------------------------

/** A revealed gate nobody steps on for 10 s moves: under a rock half the time, else to an open tile. */
function updateGateWander(state: GameState): void {
  const { grid } = state;
  if (!state.rules.gateWander || state.gate < 0 || grid.cells[state.gate] !== Cell.Empty) {
    state.gateWait = 0;
    return;
  }
  if (++state.gateWait < GATE_WAIT_TICKS) return;
  state.gateWait = 0;
  const far = (i: number) =>
    state.players.every((p) => !p.alive || Math.abs(playerTile(p)[0] - (i % grid.w)) + Math.abs(playerTile(p)[1] - Math.floor(i / grid.w)) >= 4);
  const rocks: number[] = [];
  const open: number[] = [];
  grid.cells.forEach((c, i) => {
    if (i === state.gate || state.items[i] !== Item.None) return;
    if (c === Cell.Rock) rocks.push(i);
    else if (c === Cell.Empty && far(i) && !state.charges.some((k) => k.ty * grid.w + k.tx === i)) open.push(i);
  });
  const underRock = rocks.length > 0 && (open.length === 0 || nextInt(state, 2) === 0);
  const pool = underRock ? rocks : open;
  if (pool.length === 0) return;
  state.gate = pool[nextInt(state, pool.length)];
  state.events.push({ type: 'gate_moved', hidden: underRock });
}
