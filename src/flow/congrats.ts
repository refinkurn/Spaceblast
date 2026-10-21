import { t } from '../utils/i18n';
// The match winner screen: trophy, the champion's name, final standings and
// confetti. Online, "Back to room" returns everyone to the lobby.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface Standing {
  name: string;
  color: number;
  wins: number;
  you: boolean;
}

export interface CongratsButton {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export class Congrats {
  private el = $('congrats');

  get open(): boolean {
    return !this.el.hidden;
  }

  show(winner: Standing | null, standings: Standing[], buttons: CongratsButton[]): void {
    const name = $('congrats-name');
    name.textContent = winner ? (winner.you ? t('common.you') : winner.name) : t('congrats.nobody');
    name.style.color = winner ? css(winner.color) : '';
    $('congrats-line').textContent = winner ? (winner.you ? t('congrats.youWon') : t('congrats.wins')) : t('congrats.draw');
    $('congrats-kicker').textContent = winner?.you ? t('congrats.kicker') : t('congrats.over');

    const list = $('congrats-standings');
    list.innerHTML = '';
    [...standings].sort((a, b) => b.wins - a.wins).forEach((s, i) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = css(s.color);
      const label = document.createElement('span');
      label.className = 'who';
      label.textContent = `${i + 1}. ${s.name}${s.you && s.name !== t('common.you') ? t('congrats.youTag') : ''}`;
      const wins = document.createElement('span');
      wins.className = 'wins';
      wins.textContent = `${s.wins} ${s.wins === 1 ? 'win' : 'wins'}`;
      li.append(dot, label, wins);
      list.append(li);
    });

    const actions = $('congrats-actions');
    actions.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      el.className = b.primary ? 'primary' : 'quiet';
      el.addEventListener('click', () => b.onClick());
      actions.append(el);
    }

    this.confetti(winner?.color);
    this.el.hidden = false;
    (actions.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Enter / Space presses the first button. */
  pressPrimary(): void {
    if (this.open) ($('congrats-actions').querySelector('button') as HTMLButtonElement | null)?.click();
  }

  private confetti(color?: number): void {
    const box = $('congrats-confetti');
    box.innerHTML = '';
    const colors = [color ? css(color) : '#5ad1ff', '#ffd23f', '#ff5fa2', '#5ad1ff', '#4fd17a', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement('i');
      // Math.random is fine here: decoration only.
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 2.5}s`;
      piece.style.animationDuration = `${2.4 + Math.random() * 2}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.append(piece);
    }
  }
}
