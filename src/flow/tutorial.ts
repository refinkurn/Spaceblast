import { Cell, TILE } from '../sim/constants';
import { playerTile, type GameState } from '../sim/state';
import { BEATS, CONTROL_WORDS, TIPS, type Beat } from './tutorial_script';

// The Story Mode tutorial: short coach messages in the first levels, one at a
// time. Each step waits for its trigger (the level starting, the first charge,
// the Warp Gate appearing...), stays until it's done or its time runs out, and
// never shows again on this device. The text lives in tutorial_script.ts.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const KEY = 'spaceblast.tutorial';
/** A "timer" step stays 4 s; any step leaves after 9 s at most (in game time). */
const TIMER_TICKS = 240;
const MAX_TICKS = 540;

/** A random tip for a briefing card or a Game over screen. */
export function randomTip(tips: readonly string[] = TIPS): string {
  return tips[Math.floor(Math.random() * tips.length)]; // UI only, not the sim
}

/** Replaces [MOVE] and [CHARGE] with the player's own controls. */
export function withControls(text: string, touch: boolean): string {
  const words = touch ? CONTROL_WORDS.touch : CONTROL_WORDS.keyboard;
  return text.replace(/\[(MOVE|CHARGE)\]/g, (_, k: 'MOVE' | 'CHARGE') => words[k]);
}

export class Tutorial {
  private seen = new Set<string>();
  private level = 0;
  private queue: Beat[] = [];
  private current: Beat | null = null;
  private shownAt = 0;
  private finished = false;
  /** A "near_target" step waiting for a rock or Martian next to the hero. */
  private waitingNear: Beat | null = null;
  private spawn = { x: 0, y: 0 };
  private el = $('coach');
  private text = $('coach-text');

  constructor() {
    try {
      for (const id of JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) this.seen.add(id);
    } catch { /* private mode or broken data: show the tutorial */ }
  }

  /** Settings: show the tutorial again from the start. */
  reset(): void {
    this.seen.clear();
    this.save();
  }

  /** A Story level begins (after its scenes and briefing). */
  start(level: number, state: GameState): void {
    this.stop();
    this.level = level;
    const hero = state.players[0];
    this.spawn = { x: hero.x, y: hero.y };
    for (const b of this.beats()) if (b.trigger === 'level_start') this.queue.push(b);
  }

  /** Leaving the level (menu, game over, next level). */
  stop(): void {
    this.queue = [];
    this.current = null;
    this.waitingNear = null;
    this.level = 0;
    this.el.hidden = true;
  }

  /** Every Story tick, after the step: triggers from the tick's events and the hero's position. */
  tick(state: GameState): void {
    if (!this.level) return;
    for (const e of state.events) {
      if (e.type === 'charge_placed' || e.type === 'rock_broken' || e.type === 'martian_killed' || e.type === 'gate_opened') this.trigger(e.type);
      if (e.type === 'item_picked' && e.id === 0) this.trigger('item_picked');
      if (this.current?.done === e.type) this.finished = true;
      // Already did what a waiting step would ask for: it's not needed any more.
      for (const b of [this.waitingNear, ...this.queue]) {
        if (b && b.done === e.type) this.skip(b);
      }
    }
    const hero = state.players[0];
    if (this.current?.done === 'moved' && (hero.x !== this.spawn.x || hero.y !== this.spawn.y)) this.finished = true;
    if (this.waitingNear && nearTarget(state)) {
      this.queue.push(this.waitingNear);
      this.waitingNear = null;
    }
    const age = state.tick - this.shownAt;
    if (this.current && (this.finished || age > MAX_TICKS || (this.current.done === 'timer' && age > TIMER_TICKS))) this.next(this.current);
    if (!this.current && this.queue.length) this.show(this.queue.shift()!, state.tick);
  }

  /** Shows or hides the coach bubble (hidden while a menu, card or scene is up). */
  update(visible: boolean): void {
    this.el.hidden = !visible || !this.current;
  }

  private beats(): Beat[] {
    return BEATS.filter((b) => b.level === this.level && !this.seen.has(b.id));
  }

  private trigger(kind: string): void {
    for (const b of this.beats()) {
      if (b.trigger === kind && b !== this.current && !this.queue.includes(b)) this.queue.push(b);
    }
  }

  private show(beat: Beat, tick: number): void {
    this.current = beat;
    this.shownAt = tick;
    this.finished = false;
    // Seen as soon as it shows: a step never repeats, even if the level is lost.
    this.seen.add(beat.id);
    this.save();
    this.text.textContent = withControls(beat.prompt, window.matchMedia('(pointer: coarse)').matches);
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
  }

  /** A step is done: the step after it may be waiting for that. */
  private next(done: Beat): void {
    this.current = null;
    const after = BEATS[BEATS.indexOf(done) + 1];
    if (!after || after.level !== this.level || this.seen.has(after.id)) return;
    if (after.trigger === 'after_previous') this.queue.push(after);
    if (after.trigger === 'near_target') this.waitingNear = after;
  }

  private skip(beat: Beat): void {
    if (this.waitingNear === beat) this.waitingNear = null;
    this.queue = this.queue.filter((b) => b !== beat);
    this.seen.add(beat.id);
    this.save();
  }

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify([...this.seen])); } catch { /* private mode */ }
  }
}

/** Is a rock or a Martian right next to the hero? */
function nearTarget(state: GameState): boolean {
  const [hx, hy] = playerTile(state.players[0]);
  const { grid } = state;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = hx + dx, y = hy + dy;
    if (x >= 0 && y >= 0 && x < grid.w && y < grid.h && grid.cells[y * grid.w + x] === Cell.Rock) return true;
  }
  return state.martians.some((m) => m.alive && Math.abs(m.x / TILE - hx) + Math.abs(m.y / TILE - hy) <= 2);
}
