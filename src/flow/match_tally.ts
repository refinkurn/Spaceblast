import type { GameState, SimEvent } from '../sim/state';

// What happened this level or round, for the end-of-match stats: rocks
// destroyed, Martians defeated, power-ups you picked up. Counted from sim
// events (view side only); starts over whenever a new game state begins.

export class MatchTally {
  rocks = 0;
  martians = 0;
  powerups = 0;
  private state: GameState | null = null;

  /** Counts one tick's events. `local` is this browser's player id. */
  track(state: GameState, events: readonly SimEvent[], local: number): void {
    if (state !== this.state) this.reset(state);
    for (const e of events) {
      if (e.type === 'rock_broken') this.rocks++;
      else if (e.type === 'martian_killed') this.martians++;
      else if (e.type === 'item_picked' && e.id === local) this.powerups++;
    }
  }

  reset(state: GameState | null = null): void {
    this.state = state;
    this.rocks = this.martians = this.powerups = 0;
  }
}

/** The game's one tally (main.ts feeds it every tick). */
export const tally = new MatchTally();
