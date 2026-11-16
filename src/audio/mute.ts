// Who currently asks for silence: an ad that is playing, the portal's own mute setting (CrazyGames
// muteAudio). Sound is back only when nobody asks. Separate from the player's Settings choice, which
// is never changed by either.

export type MuteSource = 'ad' | 'portal';

export class MuteSources {
  private on = new Set<MuteSource>();

  set(source: MuteSource, silent: boolean): void {
    if (silent) this.on.add(source);
    else this.on.delete(source);
  }

  get silent(): boolean {
    return this.on.size > 0;
  }
}
