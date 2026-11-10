import { Item } from '../sim/constants';
import { playerTile, type SimEvent } from '../sim/state';
import { haptics } from './haptics';
import { t } from '../utils/i18n';
import { session } from './session';

/** What the sim-event handler needs from the rest of the game. */
export interface EventDeps {
  announcer: { flash(text: string): void };
  roundOver(winner: number): void;
}

/** The reaction to one sim event: haptics, alerts, and the end of a round. (Effects and sounds are done by the view and audio.) */
export function createEventHandler(d: EventDeps): (e: SimEvent) => void {
  return function onEvent(e: SimEvent) {
    const { state, localId, quiet } = session;
    switch (e.type) {
      case 'charge_placed': {
        // A short buzz when your own astronaut sets a Charge (it appears on your tile).
        const me = state.players[localId];
        if (me && !quiet) {
          const [tx, ty] = playerTile(me);
          if (tx === e.tx && ty === e.ty) haptics.buzz(30);
        }
        break;
      }
      case 'item_picked':
        // A light tap when your astronaut grabs a power-up (not for Star Dots: too many).
        if (e.id === localId && !quiet && e.item !== Item.Gem) haptics.buzz(15);
        break;
      case 'armor_hit':
        d.announcer.flash(t('alert.vestHit'));
        break;
      case 'gate_moved':
        d.announcer.flash(e.hidden ? t('alert.gateMovedHidden') : t('alert.gateMoved'));
        break;
      case 'round_over':
        d.roundOver(e.winner);
        break;
    }
  };
}
