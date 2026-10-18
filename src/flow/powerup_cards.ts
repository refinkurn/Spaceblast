import { Item } from '../sim/constants';
import { OXYGEN, POWER_ICONS } from './hud';
import type { IntroCard } from './intro_card';
import { KIT } from './story_scenes';

// Power-up cards: shown the first time you pick up each power-up in Story Mode
// (once per save). Plain data, so the story team can rewrite it.
// Each card is one cutscene shot (focus, text, speaker...) plus its name and tip.

export const POWERUP_CARDS: Partial<Record<Item, IntroCard>> = {
  [Item.BeamRange]: {
    id: 'beam_range', name: 'Beam Range+', icon: POWER_ICONS.range, focus: 'hero', zoom: 0.6, ...KIT,
    text: 'Your blasts reach one more tile in each direction.',
    label: 'How to use',
    hint: 'Plan your shots. Longer range means you can stay further from danger.',
  },
  [Item.ExtraCharge]: {
    id: 'extra_charge', name: 'Extra Charge', icon: POWER_ICONS.charges, focus: 'hero', zoom: 0.6, ...KIT,
    text: 'You can have one more charge on the board at once.',
    label: 'How to use',
    hint: "Drop several charges to cover more ground. But don't trap yourself.",
  },
  [Item.JetBoots]: {
    id: 'speed_boost', name: 'Speed Boost', icon: POWER_ICONS.speed, focus: 'hero', zoom: 0.6, ...KIT,
    text: 'You walk faster.',
    label: 'How to use',
    hint: 'Use speed to escape Martians or reach the Warp Gate in time.',
  },
  [Item.OxygenVest]: {
    id: 'oxygen_vest', name: 'Oxygen Vest', icon: OXYGEN, focus: 'hero', zoom: 0.6, ...KIT,
    text: 'Absorbs one hit and gives you a short shield.',
    label: 'How to use',
    hint: "It triggers automatically when you're hit. You're safe for a moment. Use that time to escape.",
  },
  [Item.FreezePulse]: {
    id: 'freeze_pulse', name: 'Freeze Pulse', icon: POWER_ICONS.freeze, focus: 'hero', zoom: 0.6, ...KIT,
    text: 'Freezes every Martian for 3 seconds.',
    label: 'How to use',
    hint: "It goes off the moment you pick it up. It's your emergency button: grab it when you're surrounded.",
  },
};
