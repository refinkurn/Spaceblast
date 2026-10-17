import { bossWarning } from '../sim/boss';
import { COLLAPSE_WARNING_TICKS, LevelEvent } from '../sim/constants';
import type { GameState } from '../sim/state';

// On-screen warnings. Big ones (Maze Shift, Blackout, boss waves, the arena
// collapse) pop up large in the middle-top of the screen with a countdown,
// hard to miss. Small notes (waiting for a player, short messages) use the
// pill under the HUD.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

type Kind = 'maze' | 'blackout' | 'boss' | 'collapse';

interface Big {
  kind: Kind;
  title: string;
  /** Countdown seconds, or 0 for "now!". */
  count: number;
}

const secs = (ticks: number) => Math.ceil(ticks / 60);

function bigFor(state: GameState): Big | null {
  if (state.status !== 'playing') return null;
  if (state.boss && bossWarning(state)) return { kind: 'boss', title: `Boss wave ${state.boss.wave + 1}`, count: secs(state.boss.timer) };
  if (state.event !== LevelEvent.None && state.eventWarning > 0 && !state.boss) {
    const maze = state.event === LevelEvent.MazeShift;
    return { kind: maze ? 'maze' : 'blackout', title: maze ? 'Maze Shift' : 'Blackout', count: secs(state.eventWarning) };
  }
  if (state.mode === 'battle') {
    if (state.timeLeft > 0 && state.timeLeft <= COLLAPSE_WARNING_TICKS) return { kind: 'collapse', title: 'Arena collapse', count: secs(state.timeLeft) };
    // "Collapsing!" stays big for 2 s, then shrinks to the small pill.
    if (state.timeLeft === 0 && state.collapseTicks < 120) return { kind: 'collapse', title: 'Arena collapsing!', count: 0 };
  }
  return null;
}

export class Announcer {
  private big = $('announce');
  private bigTitle = $('announce-title');
  private bigCount = $('announce-count');
  private small = $('alert');
  private flashText = '';
  private flashUntil = 0;
  private shown = '';

  /** A short note in the small pill for 2 s. */
  flash(text: string): void {
    this.flashText = text;
    this.flashUntil = performance.now() + 2000;
  }

  /** `waiting`: names of players whose input is late (online). `hidden`: a menu or card is open. */
  update(state: GameState, now: number, waiting: string, hidden: boolean): void {
    const big = hidden ? null : bigFor(state);
    const key = big ? `${big.kind}|${big.title}` : '';
    if (key !== this.shown) {
      this.shown = key;
      this.big.hidden = !big;
      if (big) {
        this.big.className = `announce ${big.kind}`;
        this.bigTitle.textContent = big.title;
        // Restart the pop-in animation.
        void this.big.offsetWidth;
        this.big.classList.add('pop');
      }
    }
    if (big) {
      const count = big.count > 0 ? String(big.count) : '';
      if (this.bigCount.textContent !== count) {
        this.bigCount.textContent = count;
        this.bigCount.classList.remove('tick');
        void this.bigCount.offsetWidth;
        this.bigCount.classList.add('tick');
      }
    }

    const parts: string[] = [];
    if (state.event === LevelEvent.Blackout && state.eventActive > 0) parts.push(`Blackout · ${secs(state.eventActive)}s`);
    if (state.mode === 'battle' && state.timeLeft === 0 && !big) parts.push('Arena collapsing!');
    if (waiting) parts.push(`Waiting for ${waiting}…`);
    if (parts.length === 0 && now < this.flashUntil) parts.push(this.flashText);
    const text = parts.join(' · ');
    this.small.hidden = hidden || text === '' || state.status !== 'playing';
    if (this.small.textContent !== text) this.small.textContent = text;
  }
}
