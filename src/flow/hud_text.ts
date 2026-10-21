import { bossWaveCount } from '../sim/boss';
import { GATE_WAIT_TICKS } from '../sim/constants';
import { gateOpen } from '../sim/items';
import type { GameState } from '../sim/state';
import { bossClearLine } from './summary';

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

export interface HudText {
  /** Top-centre chip. */
  stage: string;
  stageClass: '' | 'boss';
  /** Short objective under the power-ups (top-left column). */
  goal: string;
  /** Top-centre clock, only for battle/online rounds and boss waves; '' otherwise. */
  clock: string;
}

export const clock = (ticks: number) => {
  const s = Math.max(0, Math.ceil(ticks / 60));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Story level chip, `1-3` style like the level card (within the sector). */
export const levelChip = (level: number, sector: number) => `${sector}-${((level - 1) % 5) + 1}`;

/** All the HUD's words for this frame. Pure: reads state, writes nothing. */
export function hudText(state: GameState, info: HudInfo): HudText {
  if (info.mode === 'online') {
    const o = info.online ?? { mine: 0, best: 0 };
    return { stage: `Round ${info.round} · You ${o.mine}–${o.best} Top`, stageClass: '', goal: 'Last one standing', clock: clock(state.timeLeft) };
  }
  if (info.mode === 'battle') {
    return { stage: `Round ${info.round} · You ${info.score[0]}–${info.score[1]} Bot`, stageClass: '', goal: 'Last one standing', clock: clock(state.timeLeft) };
  }
  if (state.boss) {
    const b = state.boss;
    const total = bossWaveCount(b);
    const last = b.wave >= total;
    return {
      stage: `BOSS WAVE ${Math.max(1, b.wave)}/${total}`,
      stageClass: 'boss',
      // Bosses are outlasted, never defeated (canon): same words as the end-of-level card.
      goal: !b.alive ? bossClearLine(b.kind) : last ? 'Survive the boss' : 'Survive the waves',
      clock: b.alive ? clock(b.timer) : '',
    };
  }
  if (state.rival) return { stage: 'RIVAL DUEL', stageClass: 'boss', goal: 'Stun Ducking', clock: '' };
  const goal = gateOpen(state)
    ? state.rules.gateWander ? `Gate moves in ${clock(GATE_WAIT_TICKS - state.gateWait)}` : 'Gate open!'
    : 'Find the Gate';
  return { stage: levelChip(info.level, info.sector), stageClass: '', goal, clock: '' };
}
