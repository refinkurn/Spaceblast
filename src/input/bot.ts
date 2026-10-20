import { canWalk } from '../sim/charges';
import { Cell, DIR_DX, DIR_DY, Dir, FUSE_TICKS, Item, TILE } from '../sim/constants';
import { SAFE, dangerMap, forEachBeamTile } from '../sim/danger';
import type { PlayerCommand } from '../sim/command';
import { itemAt, playerSpeed } from '../sim/items';
import { nextInt, seedRng, type RngState } from '../sim/rng';
import { playerTile, type GameState, type Player } from '../sim/state';

// A simple battle bot, used as an input source like the keyboard.
// Each tick it: 1) escapes if its tile is about to be hit, 2) places a charge
// when that would hit a rock or the opponent AND it can still escape,
// 3) otherwise walks to a power-up, a useful spot near rocks, or the opponent.
// It reads the state but never changes it; its own RNG keeps replays exact.

const DIRS = [Dir.Up, Dir.Down, Dir.Left, Dir.Right] as const;

interface Path {
  first: Dir;
  length: number;
}

/**
 * Difficulty: Easy for beginners, Normal a fair fight, Hard about 4/5 (and the
 * level 20 Renegade Pilot).
 */
export type BotSkill = 'easy' | 'normal' | 'hard';
export const BOT_SKILLS: readonly BotSkill[] = ['easy', 'normal', 'hard'];

interface SkillProfile {
  /** Ticks between charges: a base plus a random part. */
  cooldown: [number, number];
  /** Starts escaping only once a blast is this close (ticks); slower to react. */
  reactAt: number;
  /** Chance (in %) at each tile centre to stop and dawdle for DAWDLE_TICKS when safe. */
  dawdle: number;
  /** Places charges to hit astronauts and walks after them. */
  hunts: boolean;
}

/**
 * A dawdle is one clean pause at a tile centre. (It used to be a coin flip every
 * tick, which made the bot stop-start and step backwards mid-tile.)
 */
const DAWDLE_TICKS = 20;

const SKILLS: Record<BotSkill, SkillProfile> = {
  // Slow to react, rarely bombs, never hunts you: blasts rocks and wanders.
  easy: { cooldown: [80, 80], reactAt: 75, dawdle: 32, hunts: false },
  // A fair fight: slower to bomb and a little hesitant.
  normal: { cooldown: [45, 45], reactAt: 9999, dawdle: 10, hunts: true },
  // The original battle bot's play with quick charges (also the Renegade Pilot).
  hard: { cooldown: [6, 14], reactAt: 9999, dawdle: 0, hunts: true },
};

export class Bot {
  private rng: RngState;
  /** Ticks before the bot may consider placing again (keeps it beatable). */
  private cooldown = 30;
  private wasPlacing = false;
  /** Ticks left in the current dawdle. */
  private pause = 0;

  constructor(readonly id: number, seed: number, readonly skill: BotSkill = 'normal') {
    this.rng = { rng: seedRng(seed ^ (0x5bd1e995 * (id + 1))) };
  }

  think(state: GameState): PlayerCommand {
    const me = state.players[this.id];
    const none: PlayerCommand = { dir: Dir.None, alt: Dir.None, place: false };
    if (!me?.alive) return none;
    if (this.cooldown > 0) this.cooldown--;

    const danger = dangerMap(state);
    const [tx, ty] = playerTile(me);
    const w = state.grid.w;
    const perTile = Math.ceil(TILE / playerSpeed(me));
    const skill = SKILLS[this.skill];
    const stay = { ...none, dir: holdDir(me, danger, w, skill.reactAt) };
    // 1) Escape if any tile the body overlaps is threatened (an easy bot only notices late).
    if (overlapped(me).some(([x, y]) => danger[y * w + x] !== SAFE && danger[y * w + x] <= skill.reactAt)) {
      const out = search(state, me, danger, perTile, (x, y) => danger[y * w + x] === SAFE, true);
      return out && out.length > 0 ? { ...none, dir: out.first } : stay;
    }

    // 2) Place a charge if it pays off and there is a way out.
    // Release the button for a tick after pressing, so the next press counts.
    if (this.wasPlacing) {
      this.wasPlacing = false;
    } else if (this.cooldown === 0 && this.ownCharges(state) < me.maxCharges && this.worthPlacing(state, me, tx, ty, skill.hunts)) {
      const after = dangerMap(state, { tx, ty, range: me.range });
      const out = search(state, me, after, perTile, (x, y) => after[y * w + x] === SAFE, true);
      // Only if the way out is short enough for this bot's reaction time.
      if (out && out.length * perTile < Math.min(FUSE_TICKS - 30, skill.reactAt - 15)) {
        const [base, spread] = skill.cooldown;
        this.cooldown = base + nextInt(this.rng, spread);
        this.wasPlacing = true;
        return { ...stay, place: true };
      }
    }

    // 3) Go somewhere useful without walking into danger (an easy bot dawdles now and then).
    if (this.pause > 0) {
      this.pause--;
      return stay;
    }
    if (skill.dawdle > 0 && me.x % TILE === 0 && me.y % TILE === 0 && nextInt(this.rng, 100) < skill.dawdle) {
      this.pause = DAWDLE_TICKS - 1;
      return stay;
    }
    // The nearest opponent (battles can have up to 4 astronauts).
    const foe = state.players
      .filter((p) => p.id !== this.id && p.alive)
      .sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.y - me.y) - (Math.abs(b.x - me.x) + Math.abs(b.y - me.y)) || a.id - b.id)[0];
    const goal = (x: number, y: number) =>
      itemAt(state, x, y) !== Item.None ||
      (this.cooldown < 10 && this.ownCharges(state) < me.maxCharges && this.worthPlacing(state, me, x, y, skill.hunts));
    const path = search(state, me, danger, perTile, goal, false);
    if (path && path.length > 0) return { ...none, dir: path.first };
    if (foe && skill.hunts) {
      const [fx, fy] = playerTile(foe);
      const chase = search(state, me, danger, perTile, (x, y) => Math.abs(x - fx) + Math.abs(y - fy) <= 1, false);
      if (chase && chase.length > 0) return { ...none, dir: chase.first };
    }
    return stay;
  }

  private ownCharges(state: GameState): number {
    return state.charges.filter((c) => c.owner === this.id).length;
  }

  /** Would a charge on (x, y) hit a rock (or, when hunting, a rival astronaut)? */
  private worthPlacing(state: GameState, me: Player, x: number, y: number, hunts: boolean): boolean {
    if (state.charges.some((c) => c.tx === x && c.ty === y)) return false;
    let hit = false;
    forEachBeamTile(state, x, y, me.range, (bx, by, cell) => {
      if (cell === Cell.Rock) hit = true;
      if (!hunts) return;
      for (const p of state.players) {
        if (p.id === me.id || !p.alive) continue;
        const [px, py] = playerTile(p);
        if (px === bx && py === by) hit = true;
      }
    });
    return hit;
  }
}

/** Tiles the player's body overlaps (one, or two when between tiles). */
function overlapped(p: Player): [number, number][] {
  const xs = [Math.floor(p.x / TILE), Math.ceil(p.x / TILE)];
  const ys = [Math.floor(p.y / TILE), Math.ceil(p.y / TILE)];
  const out: [number, number][] = [];
  for (const x of new Set(xs)) for (const y of new Set(ys)) out.push([x, y]);
  return out;
}

/**
 * How to stand still. Steering back to the tile centre every tick overshoots
 * it (a step is 67 units, the centre is rarely an exact step away) and the bot
 * wobbles around it forever. With no input the movement rules glide on to the
 * centre ahead and stop exactly there, so do that, unless that tile is
 * threatened soon enough for this bot to care (`reactAt`, as when escaping):
 * then turn back towards the current centre.
 */
function holdDir(p: Player, danger: Int16Array, w: number, reactAt: number): Dir {
  if (p.x % TILE === 0 && p.y % TILE === 0) return Dir.None;
  const ahead = (v: number, f: number) => (f > 0 ? Math.ceil(v / TILE) : f < 0 ? Math.floor(v / TILE) : Math.round(v / TILE));
  const t = danger[ahead(p.y, DIR_DY[p.facing]) * w + ahead(p.x, DIR_DX[p.facing])];
  return t === SAFE || t > reactAt ? Dir.None : toCentre(p);
}

/** Direction back to the centre of the current tile, or None when centred. */
function toCentre(p: Player): Dir {
  const [tx, ty] = playerTile(p);
  if (p.x !== tx * TILE) return p.x < tx * TILE ? Dir.Right : Dir.Left;
  if (p.y !== ty * TILE) return p.y < ty * TILE ? Dir.Down : Dir.Up;
  return Dir.None;
}

/**
 * Breadth-first search from the bot's tile to the nearest tile matching `goal`.
 * Never steps into a live beam. When `escaping`, threatened tiles may be crossed
 * if the bot gets through before they blow; otherwise they are avoided.
 */
function search(
  state: GameState,
  me: Player,
  danger: Int16Array,
  perTile: number,
  goal: (x: number, y: number) => boolean,
  escaping: boolean,
): Path | null {
  const { w, h } = state.grid;
  const [sx, sy] = playerTile(me);
  const first = new Int8Array(w * h).fill(-1);
  const depth = new Int16Array(w * h).fill(-1);
  const queue = [sy * w + sx];
  depth[sy * w + sx] = 0;
  if (goal(sx, sy)) return { first: Dir.None, length: 0 };
  while (queue.length > 0) {
    const i = queue.shift()!;
    const x = i % w, y = Math.floor(i / w);
    for (const d of DIRS) {
      const nx = x + DIR_DX[d], ny = y + DIR_DY[d];
      const ni = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || depth[ni] !== -1) continue;
      if (!canWalk(state, me, nx, ny)) continue;
      const arrive = (depth[i] + 1) * perTile;
      const t = danger[ni];
      if (t === 0) continue;
      if (t !== SAFE && (!escaping || t <= arrive + 12)) continue;
      depth[ni] = depth[i] + 1;
      first[ni] = depth[i] === 0 ? d : first[i];
      if (goal(nx, ny)) return { first: first[ni] as Dir, length: depth[ni] };
      queue.push(ni);
    }
  }
  return null;
}
