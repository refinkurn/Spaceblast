import { DIR_DX, DIR_DY, Dir, PLAYER_SPEED, TILE } from './constants';
import type { PlayerCommand } from './command';
import type { Player } from './state';

// Grid-locked movement, ported from the Godot prototype to integer math.
//
// Invariant: a player is always centred on at least one axis, i.e. it moves
// along row/column "lanes". Turning while off-centre triggers corner assist:
// slide onto the nearest lane whose next tile is open, then continue.

/** Can the player enter this tile? (Grid, charges, later Martians.) */
export type Walkable = (tx: number, ty: number) => boolean;

/** Applies one tick of movement. Returns true if the player moved. */
export function movePlayer(walkable: Walkable, p: Player, cmd: PlayerCommand, speed = PLAYER_SPEED): boolean {
  if (cmd.dir === Dir.None) {
    settle(p, speed);
    return false;
  }
  for (const d of cmd.alt === Dir.None ? [cmd.dir] : [cmd.dir, cmd.alt]) {
    if (tryMove(walkable, p, d, speed)) {
      p.facing = d;
      return true;
    }
  }
  return false;
}

function tryMove(walkable: Walkable, p: Player, d: Dir, budget: number): boolean {
  const alongX = DIR_DX[d] !== 0;
  const s = alongX ? DIR_DX[d] : DIR_DY[d];
  // `main` is the axis we travel along, `perp` the one that must be lane-aligned.
  let main = alongX ? p.x : p.y;
  let perp = alongX ? p.y : p.x;
  const open = (mainTile: number, perpTile: number) =>
    alongX ? walkable(mainTile, perpTile) : walkable(perpTile, mainTile);
  const write = () => {
    const moved = (alongX ? p.x !== main || p.y !== perp : p.y !== main || p.x !== perp);
    if (alongX) { p.x = main; p.y = perp; } else { p.y = main; p.x = perp; }
    return moved;
  };

  let lane = Math.round(perp / TILE);
  if (perp !== lane * TILE) {
    // Corner assist: we straddle two lanes. Prefer the nearer one whose next
    // tile in `d` is open, else the other; slide towards its centre.
    const m = Math.round(main / TILE);
    const lo = Math.floor(perp / TILE);
    const far = lane === lo ? lo + 1 : lo;
    const laneOpen = (q: number) => open(m, q) && open(m + s, q);
    let target: number;
    if (laneOpen(lane)) target = lane;
    else if (laneOpen(far)) target = far;
    else return false;
    const delta = target * TILE - perp;
    const step = Math.min(budget, Math.abs(delta));
    perp += Math.sign(delta) * step;
    budget -= step;
    if (step < Math.abs(delta)) return write();
    lane = target;
  }
  perp = lane * TILE;

  // Straight travel, one tile centre at a time.
  while (budget > 0) {
    const aligned = main % TILE === 0;
    // Mid-tile, the tile ahead is one we already overlap, so it is open.
    if (aligned && !open(main / TILE + s, lane)) break;
    const next = aligned ? main + s * TILE : s > 0 ? Math.ceil(main / TILE) * TILE : Math.floor(main / TILE) * TILE;
    const step = Math.min(budget, Math.abs(next - main));
    main += s * step;
    budget -= step;
  }
  return write();
}

/** No input: finish the current step by gliding to the next tile centre. */
function settle(p: Player, budget: number): void {
  const fx = DIR_DX[p.facing];
  const fy = DIR_DY[p.facing];
  p.x = glide(p.x, fx, budget);
  p.y = glide(p.y, fy, budget);
}

function glide(v: number, facing: number, budget: number): number {
  if (v % TILE === 0) return v;
  const target =
    facing > 0 ? Math.ceil(v / TILE) * TILE : facing < 0 ? Math.floor(v / TILE) * TILE : Math.round(v / TILE) * TILE;
  const delta = target - v;
  return v + Math.sign(delta) * Math.min(budget, Math.abs(delta));
}
