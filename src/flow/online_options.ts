import { BOT_LEVELS, type RoomSettings } from '../net/protocol';
import { ROUND_SECONDS } from '../sim/constants';
import { t } from '../utils/i18n';
import type { StepOption } from './stepper';

// The lobby's match options as ‹ value › selector choices. Maze Shift and
// Blackout are two switches in the room settings; the lobby shows them as one
// "Scenarios" choice (Off / Maze Shift / Blackout / Both).

export type Scenario = 'off' | 'maze' | 'blackout' | 'both';

export function scenarioOf(s: Pick<RoomSettings, 'maze' | 'blackout'>): Scenario {
  if (s.maze && s.blackout) return 'both';
  if (s.maze) return 'maze';
  if (s.blackout) return 'blackout';
  return 'off';
}

export function scenarioFlags(s: Scenario): Pick<RoomSettings, 'maze' | 'blackout'> {
  return { maze: s === 'maze' || s === 'both', blackout: s === 'blackout' || s === 'both' };
}

export const timeLabel = (s: number) => (s < 120 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

export const timeOptions = (): StepOption<number>[] => ROUND_SECONDS.map((s) => ({ value: s, label: timeLabel(s) }));

export const scenarioOptions = (): StepOption<Scenario>[] => [
  { value: 'off', label: t('lobby.scen.off') },
  { value: 'maze', label: t('html.set-maze') },
  { value: 'blackout', label: t('html.set-blackout') },
  { value: 'both', label: t('lobby.scen.both') },
];

export const matchOptions = (): StepOption<RoomSettings['match']>[] => [
  { value: 'bo3', label: t('lobby.match.bo3') },
  { value: 'ft3', label: t('lobby.match.ft3') },
];

export const botLevelOptions = (): StepOption<RoomSettings['botLevel']>[] => BOT_LEVELS.map((l) => ({ value: l, label: t(`menu.${l}`) }));
