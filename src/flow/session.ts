import type { Bot } from '../input/bot';
import type { GameState } from '../sim/state';
import type { MenuChoice } from './screens';
import type { OnlineRound } from './online_match';

/**
 * The one shared, mutable session: what main.ts, the battle flow, the sim-event
 * handler, online play and the keyboard handler all read and write. One object,
 * so no module keeps its own copy.
 */
export interface Session {
  mode: MenuChoice;
  state: GameState;
  bot: Bot | null;
  /** The game waits while the level card is up. */
  cardUp: boolean;
  /** The online round being played; null outside online play. */
  net: OnlineRound | null;
  /** Sim player id of this browser's astronaut (always 0 offline). */
  localId: number;
  lastWinner: number;
  /** Set when a run was started from the developer level select; enables its cheats. */
  devRun: boolean;
  /** Quiet ticks (catching up after a reconnect): no effects, sounds or hash messages. */
  quiet: boolean;
  /** Online: the first Menu press mid-round asks before leaving the room. */
  leaveAsked: boolean;
}

export const session: Session = {
  mode: 'survival',
  state: undefined as unknown as GameState,
  bot: null,
  cardUp: false,
  net: null,
  localId: 0,
  lastWinner: -1,
  devRun: false,
  quiet: false,
  leaveAsked: false,
};
