import { Item } from '../sim/constants';
import { OXYGEN, POWER_ICONS } from './hud';
import type { IntroCard } from './intro_card';
import { KIT } from './story_scenes';

// Power-up cards: shown the first time you pick up each power-up in Story Mode
// (once per save). Plain data, so the story team can rewrite it.
// Each card is one cutscene shot (focus, text, speaker...) plus its name and icon.
// Text: the Master Narrative Script (Captain Kit speaks every card).

export const POWERUP_CARDS: Partial<Record<Item, IntroCard>> = {
  [Item.BeamRange]: {
    id: 'beam_range', name: 'Beam Range+', icon: POWER_ICONS.range, focus: 'hero', zoom: 0.6, ...KIT,
    text: "Longer blasts, greater reach. Watch where you stand.",
  },
  [Item.ExtraCharge]: {
    id: 'extra_charge', name: 'Extra Charge', icon: POWER_ICONS.charges, focus: 'hero', zoom: 0.6, ...KIT,
    text: "One more charge. Try not to trap yourself.",
  },
  [Item.JetBoots]: {
    id: 'speed_boost', name: 'Speed Boost', icon: POWER_ICONS.speed, focus: 'hero', zoom: 0.6, ...KIT,
    text: "A little extra speed. Handy when trouble's chasing you.",
  },
  [Item.OxygenVest]: {
    id: 'oxygen_vest', name: 'Oxygen Vest', icon: OXYGEN, focus: 'hero', zoom: 0.6, ...KIT,
    text: "Extra protection for hazardous environments. Keep it on.",
  },
  [Item.FreezePulse]: {
    id: 'freeze_pulse', name: 'Freeze Pulse', icon: POWER_ICONS.freeze, focus: 'hero', zoom: 0.6, ...KIT,
    text: "Freezes nearby threats temporarily. A little breathing room.",
  },
};
