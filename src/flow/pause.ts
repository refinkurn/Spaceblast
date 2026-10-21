// The pause card (offline Story and Battle vs Bot): Resume, Restart, Settings,
// Quit to menu (with a confirm). It only raises a flag; main.ts's loop reads
// `open` to hold the game, so nothing here touches the sim.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface PauseActions {
  restart(): void;
  settings(back: () => void): void;
  quit(): void;
}

export const restartLabel = (mode: 'survival' | 'battle' | 'online') => (mode === 'battle' ? 'Restart round' : 'Restart level');

export class PauseMenu {
  private card = $('pause-card');
  private main = $('pause-main');
  private confirm = $('pause-confirm');
  private restartBtn = $<HTMLButtonElement>('pause-restart');

  constructor(actions: PauseActions) {
    $('pause-resume').addEventListener('click', () => this.close());
    this.restartBtn.addEventListener('click', () => { this.close(); actions.restart(); });
    $('pause-settings').addEventListener('click', () => {
      this.card.hidden = true;
      actions.settings(() => { this.card.hidden = false; $('pause-resume').focus(); });
    });
    $('pause-quit').addEventListener('click', () => this.showConfirm(true));
    $('pause-keep').addEventListener('click', () => this.showConfirm(false));
    $('pause-quit-yes').addEventListener('click', () => { this.close(); actions.quit(); });
  }

  /** True while the card (or the Settings page opened from it) is up: the game holds. */
  open = false;

  show(mode: 'survival' | 'battle' | 'online'): void {
    this.restartBtn.textContent = restartLabel(mode);
    this.showConfirm(false);
    this.open = true;
    this.card.hidden = false;
    $('pause-resume').focus();
  }

  close(): void {
    this.open = false;
    this.card.hidden = true;
    this.showConfirm(false);
  }

  toggle(mode: 'survival' | 'battle' | 'online'): void {
    if (this.open) this.close();
    else this.show(mode);
  }

  private showConfirm(on: boolean): void {
    this.main.hidden = on;
    this.confirm.hidden = !on;
    (on ? $('pause-keep') : $('pause-resume')).focus();
  }
}
