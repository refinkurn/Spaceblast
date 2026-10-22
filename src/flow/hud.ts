import { MAX_BOOTS, MAX_CHARGES, MAX_RANGE, START_LIVES } from '../sim/constants';
import { haptics } from './haptics';
import type { GameState } from '../sim/state';
import { hudText, type HudInfo } from './hud_text';
import { t as tr } from '../utils/i18n';

export type { HudInfo };

// The HUD: top-left column (avatar, hearts, power-up pips, goal), top-centre
// stage chip with the clock under it (boss/battle only). Rebuilt only when
// something on it changes; hearts flash when a life or armor is lost.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const HEART =
  '<svg viewBox="0 0 24 24" class="icon heart"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
// Icons use the power-up colours from view/item_look.ts (docs/design/powerup-look.md).
export const OXYGEN =
  '<svg viewBox="0 0 24 24" class="icon oxygen"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="#ffffff" stroke="#7fe8ff" stroke-width="2" stroke-linejoin="round"/><text x="12" y="14.5" text-anchor="middle" fill="#2a8fb0" stroke="none">O2</text></svg>';
export const POWER_ICONS: Record<string, string> = {
  charges: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="14" r="7" fill="#1a103c" stroke="#00ffff" stroke-width="2"/><path d="M15 6.5l2.5-3M17.5 6l1.5 1.5" stroke="#00ffff" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="19.5" cy="3.5" r="1.8" fill="#00ffff" stroke="none"/></svg>',
  range: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2v20M2 12h20" stroke="#ff5500" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="3.2" fill="#ffcc00" stroke="none"/></svg>',
  speed: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 3h5v10l4 3v4H9v-5l3-2z" fill="#ffe600" stroke="none"/><path d="M1 8h6M2 13h5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  freeze: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#b9a4ff" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="2.4" fill="#ffffff" stroke="none"/></svg>',
};

/** Stats panel width at scale 1 (avatar, three hearts, padding), CSS px. */
export const HUD_PANEL_W = 110;
/** Largest panel scale: 30% bigger than the base size. */
export const HUD_MAX_SCALE = 1.3;

/** Stats panel height at scale 1 with everything shown (avatar row, three power-ups, goal), CSS px. */
export const HUD_PANEL_H = 150;

/** Where the board's left outline is at screen height `y` (CSS px), from its far (top) and near (bottom) corners. */
export function boardLeftAt(edge: { topX: number; topY: number; bottomX: number; bottomY: number }, y: number): number {
  const span = edge.bottomY - edge.topY;
  if (span <= 0) return Math.min(edge.topX, edge.bottomX);
  const t = Math.min(1, Math.max(0, (y - edge.topY) / span));
  return edge.topX + (edge.bottomX - edge.topX) * t;
}

/** Panel scale for `room` px of free width between the panel's left edge and the board: 1 to 1.3. */
export function hudScale(room: number): number {
  return Math.round(Math.min(HUD_MAX_SCALE, Math.max(1, room / HUD_PANEL_W)) * 100) / 100;
}

function pips(label: string, key: string, value: number, max: number): string {
  const dots = Array.from({ length: max }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('');
  return `<span class="power ${key}" title="${label} ${value}/${max}" aria-label="${label} ${value} of ${max}">${POWER_ICONS[key]}<span class="pips">${dots}</span></span>`;
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
    // Red glow at the screen edges, and a buzz where the phone can.
    const v = document.getElementById('vignette');
    if (v) {
      v.classList.remove('hit');
      void v.offsetWidth;
      v.classList.add('hit');
    }
    haptics.buzz(80);
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
      pips(tr('hud.charges'), 'charges', p.maxCharges, MAX_CHARGES) +
      pips(tr('hud.range'), 'range', p.range, MAX_RANGE) +
      pips(tr('hud.speed'), 'speed', p.boots, MAX_BOOTS) +
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
