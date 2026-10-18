import { bossWaveCount } from '../sim/boss';
import { GATE_WAIT_TICKS, MAX_BOOTS, MAX_CHARGES, MAX_RANGE, START_LIVES } from '../sim/constants';
import { gateOpen } from '../sim/items';
import type { GameState } from '../sim/state';

// The top bar: health icons, the stage chip (sector/level, BOSS WAVE, RIVAL
// DUEL or battle score), the current objective, and power-up levels as pips.
// Rebuilt only when something on it changes.

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

export interface HudInfo {
  mode: 'survival' | 'battle' | 'online';
  /** Sim player id of this browser's astronaut. */
  local: number;
  /** Online: this browser's round wins and the best of the others. */
  online?: { mine: number; best: number };
  level: number;
  sector: number;
  round: number;
  score: number[];
}

const clock = (ticks: number) => {
  const s = Math.max(0, Math.ceil(ticks / 60));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function pips(label: string, key: string, value: number, max: number): string {
  const dots = Array.from({ length: max }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('');
  return `<span class="power" title="${label} ${value}/${max}" aria-label="${label} ${value} of ${max}">${POWER_ICONS[key]}<span class="pips">${dots}</span></span>`;
}

export class Hud {
  private health = $('hud-health');
  private stage = $('hud-stage');
  private goal = $('hud-goal');
  private powers = $('hud-powers');
  private last = ['', '', '', ''];

  update(state: GameState, info: HudInfo): void {
    const p = state.players[info.local] ?? state.players[0];
    // Battle rounds give one life, so show one heart there.
    const hearts = info.mode === 'survival' ? Math.max(START_LIVES, p.lives) : Math.max(1, p.lives);
    const health =
      Array.from({ length: hearts }, (_, i) => `<span class="${i < p.lives ? '' : 'lost'}">${HEART}</span>`).join('') +
      Array.from({ length: p.armor }, () => OXYGEN).join('');

    let stage: string;
    let goal: string;
    let stageClass = '';
    if (info.mode === 'online') {
      const o = info.online ?? { mine: 0, best: 0 };
      stage = `Online · Round ${info.round} · You ${o.mine}–${o.best} Top`;
      goal = `Last one standing · ${clock(state.timeLeft)}`;
    } else if (info.mode === 'battle') {
      stage = `Round ${info.round} · You ${info.score[0]}–${info.score[1]} Bot`;
      goal = `Last one standing · ${clock(state.timeLeft)}`;
    } else if (state.boss) {
      const b = state.boss;
      const total = bossWaveCount(b);
      stage = `BOSS WAVE ${Math.max(1, b.wave)}/${total}`;
      stageClass = 'boss';
      const last = b.wave >= total;
      goal = !b.alive ? 'Boss defeated!' : last ? `Survive · boss falls in ${clock(b.timer)}` : `Survive · next wave in ${clock(b.timer)}`;
    } else if (state.rival) {
      stage = 'RIVAL DUEL';
      stageClass = 'boss';
      goal = 'Defeat the Renegade Pilot';
    } else {
      stage = `S${info.sector} · L${info.level}`;
      goal = gateOpen(state)
        ? state.rules.gateWander ? `Gate open · moves in ${clock(GATE_WAIT_TICKS - state.gateWait)}` : 'Gate open: step on it!'
        : 'Find the Warp Gate';
    }

    const powers =
      pips('Charges', 'charges', p.maxCharges, MAX_CHARGES) +
      pips('Beam range', 'range', p.range, MAX_RANGE) +
      pips('Speed', 'speed', p.boots, MAX_BOOTS) +
      (state.freeze > 0 ? `<span class="power freeze">${POWER_ICONS.freeze}${Math.ceil(state.freeze / 60)}s</span>` : '');

    const next = [health, `${stageClass}|${stage}`, goal, powers];
    if (next[0] !== this.last[0]) this.health.innerHTML = health;
    if (next[1] !== this.last[1]) {
      this.stage.textContent = stage;
      this.stage.className = `hud-chip ${stageClass}`;
    }
    if (next[2] !== this.last[2]) this.goal.textContent = goal;
    if (next[3] !== this.last[3]) this.powers.innerHTML = powers;
    this.last = next;
  }
}
