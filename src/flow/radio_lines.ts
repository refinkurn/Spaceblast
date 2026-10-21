import { Item } from '../sim/constants';

// Captain Kit's one-line radio toasts in Story Mode (docs/design/radio-juice.md).
// The words live in src/config/locales.json (keys radio.*), so script-integrator
// edits them there. `danger` lines use Kit's worried portrait.

export interface RadioLine {
  /** Key in locales.json. */
  key: string;
  danger?: boolean;
}

export const RADIO = {
  gateOpen: { key: 'radio.gateOpen' },
  lastHeart: { key: 'radio.lastHeart', danger: true },
  vestHit: { key: 'radio.vestHit', danger: true },
  lastWave: { key: 'radio.lastWave', danger: true },
} satisfies Record<string, RadioLine>;

/** After a power-up's intro card has been seen: at most once per type per level. */
export const RADIO_POWERUP: Partial<Record<Item, RadioLine>> = {
  [Item.BeamRange]: { key: 'radio.item.beamRange' },
  [Item.ExtraCharge]: { key: 'radio.item.extraCharge' },
  [Item.JetBoots]: { key: 'radio.item.speed' },
  [Item.OxygenVest]: { key: 'radio.item.vest' },
  [Item.FreezePulse]: { key: 'radio.item.freeze' },
};
