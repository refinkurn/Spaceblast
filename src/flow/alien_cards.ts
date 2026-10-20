import { Kind } from '../sim/constants';
import { martianIcon, type IntroCard } from './intro_card';
import { KIT } from './story_scenes';

// Enemy cards: shown the first time each kind of Martian comes close in Story Mode
// (once per save). Plain data, so the story team can rewrite it.
// Each card is one cutscene shot (focus, text, speaker...) plus its name and icon.
// Text: the Master Narrative Script (Captain Kit speaks every card).

export const ALIEN_CARDS: Record<Kind, IntroCard> = {
  [Kind.Goopling]: {
    id: 'goopling', name: 'Goopling', icon: martianIcon('#6fd14f'), focus: 'martian', zoom: 0.5, ...KIT,
    text: "Gooplings wander slowly. Touching one bites you.",
  },
  [Kind.Sniffer]: {
    id: 'sniffer', name: 'Sniffer', icon: martianIcon('#a66bff'), focus: 'martian', zoom: 0.5, ...KIT,
    text: "Sniffers dodge your blasts. Trap them in a corridor.",
  },
  [Kind.Phaser]: {
    id: 'phaser', name: 'Phaser', icon: martianIcon('#7f8cff'), focus: 'martian', zoom: 0.5, ...KIT,
    text: "Phasers can vanish from sight. Watch for their return.",
  },
  [Kind.Builder]: {
    id: 'builder', name: 'Builder', icon: martianIcon('#c6e33a'), focus: 'martian', zoom: 0.5, ...KIT,
    text: "Builders can block passages. Watch your route.",
  },
};
