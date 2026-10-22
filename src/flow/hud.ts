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
// Icons use the power-up colours from view/item_look.ts (docs/design/powerup-look.md) and say what
// each one does at a glance: a shield (Oxygen Vest), a charge with energy cracks (Extra Charge),
// a flame (Beam Range+), a running boot with a bolt (Speed Boost), a snowflake (Freeze Pulse).
export const OXYGEN =
  '<svg viewBox="0 0 24 24" class="icon oxygen"><path d="M12 2l8.5 3.2v6.3c0 5.3-3.6 9-8.5 10.5-4.9-1.5-8.5-5.2-8.5-10.5V5.2z" fill="#2a8fb0" stroke="#7fe8ff" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 5.2l5.6 2.1v4.3c0 3.6-2.3 6.2-5.6 7.4z" fill="#7fe8ff"/><path d="M7.5 9.5v2c0 1.6.6 3 1.6 4.1" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>';
export const POWER_ICONS: Record<string, string> = {
  charges: '<svg viewBox="0 0 24 24" class="icon"><circle cx="10.5" cy="14" r="8" fill="#1a103c" stroke="#00ffff" stroke-width="1.6"/><path d="M5.5 11.5l3 1.6-.8 3.2 3 1.2M11.5 8.6l1 3 3 .9-.6 2.8" stroke="#00ffff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="13.6" y="4.6" width="4.2" height="3.4" rx=".8" transform="rotate(42 15.7 6.3)" fill="#2a3a66" stroke="#00ffff" stroke-width="1"/><path d="M17.6 4.2c.8-1.4 2-2 3.2-1.7" stroke="#c8a46a" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="21.3" cy="2.6" r="1.5" fill="#ffe600"/></svg>',
  range: '<svg viewBox="0 0 24 24" class="icon"><path d="M12.4 2c.5 3.4 5 5.4 5 10.5a5.4 5.4 0 0 1-5.4 9.5 5.9 5.9 0 0 1-6-5.9c0-2.8 1.5-4.5 2.8-5.8.2 1.7 1 2.7 2.1 3.2-.1-3.8-.3-7 1.5-11.5z" fill="#ff5500"/><path d="M12 12.4c1.6 1.5 2.9 2.8 2.9 4.8a2.9 2.9 0 0 1-5.8.3c0-1.8 1-2.7 1.8-3.5.2.9.6 1.3 1.1 1.5-.1-1.1-.2-2 0-3.1z" fill="#ffcc00"/></svg>',
  speed: '<svg viewBox="0 0 24 24" class="icon"><path d="M3.5 16.2c0-1 .8-1.7 1.8-1.7h3.6l2-5.6c.3-.9 1.2-1.4 2.1-1.2l1.8.5-1.2 4.4 4.6 1.9c1.4.6 2.3 1.8 2.3 3.2v1.6H3.5z" fill="#ffe600"/><path d="M3.5 21h17" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/><path d="M8.6 1.5L5.2 7h2.9l-1.7 4.3 4.6-6.3H8.1l1.9-3.5z" fill="#ffffff"/></svg>',
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
