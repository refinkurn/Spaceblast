import { Kind } from '../sim/constants';
import { martianIcon, type IntroCard } from './intro_card';
import { KIT } from './story_scenes';

// Enemy cards: shown the first time each kind of Martian comes close in Story Mode
// (once per save). Plain data, so the story team can rewrite it.
// Each card is one cutscene shot (focus, text, speaker...) plus its name and tip.

export const ALIEN_CARDS: Record<Kind, IntroCard> = {
  [Kind.Goopling]: {
    id: 'goopling', name: 'Goopling', icon: martianIcon('#6fd14f'), focus: 'martian', zoom: 0.5, ...KIT,
    text: 'Slow wanderer that bites when it touches you.',
    label: 'Beware',
    hint: 'It turns at random, so it can wander right into your path. Keep your distance or blast it.',
  },
  [Kind.Sniffer]: {
    id: 'sniffer', name: 'Sniffer', icon: martianIcon('#a66bff'), focus: 'martian', zoom: 0.5, ...KIT,
    text: 'Fast, with a nose for trouble. It smells your charges and runs from the blast.',
    label: 'Beware',
    hint: 'It dodges most blasts. Trap it in a corridor or a dead end so it has nowhere to run.',
  },
  [Kind.Phaser]: {
    id: 'phaser', name: 'Phaser', icon: martianIcon('#7f8cff'), focus: 'martian', zoom: 0.5, ...KIT,
    text: 'Sneaky burrower that jumps between spots underground.',
    label: 'Beware',
    hint: "Watch the ground. You can't blast it while it hides, and it pops up fast. Don't stand still.",
  },
  [Kind.Builder]: {
    id: 'builder', name: 'Builder', icon: martianIcon('#c6e33a'), focus: 'martian', zoom: 0.5, ...KIT,
    text: 'Creates new rocks to rebuild the maze as it goes.',
    label: 'Beware',
    hint: "Don't trap yourself in a dead end while it's building.",
  },
};
