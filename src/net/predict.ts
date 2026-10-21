import { NO_COMMAND } from '../sim/command';
import { step } from '../sim/sim';
import type { Charge, GameState, Player } from '../sim/state';
import { FAR_BEHIND, type FrameSync } from './frames';

// Online, the shared game only moves on the server's frames, and your own
// presses come back in them a full round trip later. Drawn from that alone,
// your astronaut reacts 150-250 ms after you press: the game feels laggy even
// on a good connection.
//
// So your own astronaut is drawn from a prediction: each display frame copies
// the confirmed state and replays it forward with the frames already received
// plus the commands this browser has already sent (other players keep doing
// what they did last; bots stand still). Only your astronaut and your fresh
// charges are taken from that copy. The confirmed game is never touched, so
// nothing can desync, and a wrong guess (someone's charge blocked your way)
// simply snaps to the truth on the next frame.

/**
 * Never replay more than this many ticks per frame (0.75 s, enough for pings
 * up to ~500 ms), so slow phones on slow connections don't pay for it.
 */
const MAX_LEAD = 45;

export interface Prediction {
  /** Your astronaut one tick before and at the predicted tick, for interpolation. */
  prev: Player;
  cur: Player;
  /** Your charges in the prediction that the confirmed game doesn't have yet. */
  charges: Charge[];
}

export class Predictor {
  /** Ticks drawn ahead of the confirmed state, eased so the view doesn't jump. */
  private lead = 0;

  /** Ticks currently drawn ahead (for the stats overlay). */
  get ahead(): number {
    return this.lead;
  }

  reset(): void {
    this.lead = 0;
  }

  run(state: GameState, sync: FrameSync, local: number): Prediction | null {
    if (state.status !== 'playing' || !state.players[local]?.alive) return null;
    // Catching up after a stall (e.g. the app was in the background): the
    // confirmed game races ahead anyway, so predicting is wasted work.
    if (sync.buffered > FAR_BEHIND) {
      this.lead = 0;
      return null;
    }
    // Ticks from the next one to simulate up to the newest press.
    const want = Math.max(0, Math.min(MAX_LEAD, sync.aim - sync.tick + 1));
    // Move at most a tick per frame (big jumps, e.g. after a reconnect, at once).
    this.lead = Math.abs(want - this.lead) > 10 ? want : this.lead + Math.sign(want - this.lead);
    if (this.lead < 1) return null;

    const g = structuredClone(state);
    g.events = [];
    let prev: Player = { ...g.players[local] };
    for (let k = 0; k < this.lead && g.status === 'playing'; k++) {
      prev = { ...g.players[local] };
      const humans = sync.guess(sync.tick + k, local);
      const cmds = g.players.map((_, i) => humans[i] ?? NO_COMMAND);
      step(g, cmds);
      g.events.length = 0;
    }
    const cur = g.players[local];
    if (!cur.alive) return null; // a predicted knock-out is only shown once it's real
    const confirmed = (c: Charge) => state.charges.some((k) => k.tx === c.tx && k.ty === c.ty);
    return { prev, cur, charges: g.charges.filter((c) => c.owner === local && !confirmed(c)) };
  }
}
