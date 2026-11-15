import { onAdState } from '../services/crazygames';

// While a CrazyGames midgame ad plays (services/crazygames.ts midgameAd): all sound muted and taps on the
// game ignored. A transparent layer over the page takes the taps; it exists only in a build with ads.

/** Wires the ad state to `mute` and a tap-eating layer. `doc` is the page (tests pass a fake). */
export function installAdShield(mute: (on: boolean) => void, doc: Pick<Document, 'createElement' | 'body'> = document): void {
  let shield: HTMLElement | null = null;
  onAdState((playing) => {
    mute(playing);
    if (playing && !shield) {
      shield = doc.createElement('div');
      shield.id = 'ad-shield';
      shield.className = 'ad-shield';
      doc.body.append(shield);
    } else if (!playing && shield) {
      shield.remove();
      shield = null;
    }
  });
}
