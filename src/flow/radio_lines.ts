import { Item } from '../sim/constants';

// Captain Kit's one-line radio toasts in Story Mode (docs/design/radio-juice.md).
// Text only, so script-integrator can edit it. `danger` lines use Kit's worried portrait.

export interface RadioLine {
  text: string;
  danger?: boolean;
}

export const RADIO = {
  gateOpen: { text: "Kit: Gate's open. Get to it, Bosco!" },
  lastHeart: { text: 'Kit: Hang in there, Bosco! Watch those Martians!', danger: true },
  vestHit: { text: 'Kit: Vest took that one. Careful!', danger: true },
  lastWave: { text: 'Kit: Last wave. Hold on!', danger: true },
} satisfies Record<string, RadioLine>;

/** After a power-up's intro card has been seen: at most once per type per level. */
export const RADIO_POWERUP: Partial<Record<Item, RadioLine>> = {
  [Item.BeamRange]: { text: 'Kit: Longer beams. Nice.' },
  [Item.ExtraCharge]: { text: 'Kit: One more charge ready.' },
  [Item.JetBoots]: { text: "Kit: Faster boots. Don't trip." },
  [Item.OxygenVest]: { text: 'Kit: Vest on. You can take a hit.' },
  [Item.FreezePulse]: { text: 'Kit: Martians frozen. Move!' },
};
