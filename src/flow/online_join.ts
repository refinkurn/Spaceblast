import { reloadForUpdate } from '../net/build';
import { randomCode } from '../net/client';
import { savedSeat, type RoomLink } from '../net/link';
import { isRoomCode } from '../net/protocol';
import { inviteUrl } from './invite';
import { savePrefs, session } from './online_prefs';
import { t } from '../utils/i18n';

// Creating, joining and rejoining a room: the connection attempts and how a refusal is worded.

/** A refused join, in words (unknown reasons are shown as they are). */
export const errorText = (reason: string) => (['taken', 'not_found', 'full', 'bad_code', 'expired', 'update'].includes(reason) ? t(`online.err.${reason}`) : reason);


/** What the join flow needs from the online screen. */
export interface JoinUi {
  code: string;
  setStatus(text: string, error?: boolean): void;
}

export class JoinFlow {
  constructor(
    private ui: JoinUi,
    private net: RoomLink,
    private prefs: { name: string; color: number },
    private nameInput: HTMLInputElement,
  ) {}

  typedName(): string {
    const name = this.nameInput.value.trim();
    savePrefs(name, this.prefs.color);
    this.prefs.name = name;
    return name;
  }

  /** True while creating or joining: extra taps are ignored. */
  private busy = false;

  async create(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.ui.setStatus(t('online.creating'));
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const ok = await this.connect(randomCode(), true);
        if (ok !== 'taken') return;
      }
      this.ui.setStatus(t('online.createFailed'), true);
    } finally {
      this.busy = false;
    }
  }

  async join(raw: string): Promise<void> {
    if (this.busy) return;
    const code = raw.trim().toUpperCase();
    if (!isRoomCode(code)) {
      this.ui.setStatus(errorText('bad_code'), true);
      return;
    }
    this.busy = true;
    this.ui.setStatus('Joining…');
    try {
      await this.connect(code, false);
    } finally {
      this.busy = false;
    }
  }

  /** After a page reload: back into the saved seat. */
  async rejoinSaved(): Promise<void> {
    const seat = savedSeat();
    if (!seat || this.busy) return;
    this.busy = true;
    this.ui.code = seat.code;
    this.ui.setStatus('Rejoining…');
    try {
      const first = await this.net.rejoin(seat);
      if (first.t === 'error') this.refused(seat.code, first.reason);
    } catch {
      this.ui.setStatus(t('online.unreachable'), true);
    } finally {
      this.busy = false;
    }
  }

  /** Returns 'ok', an error reason, or 'offline'. */
  private async connect(code: string, create: boolean): Promise<string> {
    this.ui.code = code; // the welcome (and the lobby) can arrive before connect() resolves
    try {
      const first = await this.net.connect(code, create, this.typedName(), this.prefs.color);
      if (first.t === 'error') {
        if (first.reason !== 'taken' || !create) this.refused(code, first.reason);
        return first.reason;
      }
      return 'ok';
    } catch {
      this.ui.setStatus(t('online.unreachableHosted'), true);
      return 'offline';
    }
  }

  /**
   * A refused join, shown in words. 'update' (the room runs another build of
   * the game): reload once into the latest page, back on this room's code
   * (an invite link); if the room still refuses it, say so.
   */
  private refused(code: string, reason: string): void {
    if (reason === 'update' && reloadForUpdate(session(), Date.now(), () => window.location.assign(inviteUrl(code, window.location.href)))) {
      this.ui.setStatus(t('online.updating'));
      return;
    }
    this.ui.setStatus(errorText(reason), true);
  }
}
