import { MAX_BOOTS, MAX_CHARGES, MAX_RANGE, START_LIVES } from '../sim/constants';
import type { GameState } from '../sim/state';
import { hudText, type HudInfo } from './hud_text';

export type { HudInfo };

// The HUD: top-left column (avatar, hearts, power-up pips, goal), top-centre
// stage chip with the clock under it (boss/battle only). Rebuilt only when
// something on it changes; hearts flash when a life or armor is lost.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const HEART =
  '<svg viewBox="0 0 24 24" class="icon heart"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
export const OXYGEN =
  '<svg viewBox="0 0 24 24" class="icon oxygen"><circle cx="12" cy="12" r="9"/><text x="12" y="15.5" text-anchor="middle">O2</text></svg>';
export const POWER_ICONS: Record<string, string> = {
  charges: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="13" r="7"/><path d="M14 6l3-3" stroke-width="2"/></svg>',
  range: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2v20M2 12h20" stroke-width="4" stroke-linecap="round"/></svg>',
  speed: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6l7 6-7 6M12 6l7 6-7 6" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  freeze: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke-width="2.5" stroke-linecap="round"/></svg>',
};

function pips(label: string, key: string, value: number, max: number): string {
  const dots = Array.from({ length: max }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('');
  return `<span class="power" title="${label} ${value}/${max}" aria-label="${label} ${value} of ${max}">${POWER_ICONS[key]}<span class="pips">${dots}</span></span>`;
}

export class Hud {
  private health = $('hud-health');
  private stage = $('hud-stage');
  private clockEl = $('hud-clock');
  private goal = $('hud-goal');
  private powers = $('hud-powers');
  private last = ['', '', '', '', ''];
  private lives = -1;
  private armor = -1;

  /** Shakes and flashes the hearts row (CSS animation; restarts if already running). */
  private flash(): void {
    this.health.classList.remove('hurt');
    void this.health.offsetWidth;
    this.health.classList.add('hurt');
  }

  update(state: GameState, info: HudInfo): void {
    const p = state.players[info.local] ?? state.players[0];
    // Battle rounds give one life, so show one heart there.
    const hearts = info.mode === 'survival' ? Math.max(START_LIVES, p.lives) : Math.max(1, p.lives);
    const health =
      Array.from({ length: hearts }, (_, i) => `<span class="${i < p.lives ? '' : 'lost'}">${HEART}</span>`).join('') +
      Array.from({ length: p.armor }, () => OXYGEN).join('');

    // Losing a life or armor flashes the hearts (a new life after a game over is not a loss).
    if ((this.lives >= 0 && p.lives < this.lives) || (this.armor >= 0 && p.armor < this.armor)) this.flash();
    this.lives = p.lives;
    this.armor = p.armor;

    const t = hudText(state, info);
    const powers =
      pips('Charges', 'charges', p.maxCharges, MAX_CHARGES) +
      pips('Beam range', 'range', p.range, MAX_RANGE) +
      pips('Speed', 'speed', p.boots, MAX_BOOTS) +
      (state.freeze > 0 ? `<span class="power freeze">${POWER_ICONS.freeze}${Math.ceil(state.freeze / 60)}s</span>` : '');

    const next = [health, `${t.stageClass}|${t.stage}`, t.goal, powers, t.clock];
    if (next[0] !== this.last[0]) this.health.innerHTML = health;
    if (next[1] !== this.last[1]) {
      this.stage.textContent = t.stage;
      this.stage.className = `hud-chip ${t.stageClass}`;
    }
    if (next[2] !== this.last[2]) this.goal.textContent = t.goal;
    if (next[3] !== this.last[3]) this.powers.innerHTML = powers;
    if (next[4] !== this.last[4]) {
      this.clockEl.textContent = t.clock;
      this.clockEl.hidden = !t.clock;
    }
    this.last = next;
  }
}
