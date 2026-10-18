import type { Shot } from './cutscene';

// Story cutscene scripts: the opening crash, each sector's arrival, before and
// after each boss, and the final duel.
// Plain data, so the story can be rewritten without touching game code.

export const KIT = { speaker: 'Captain Kit (radio)', color: '#ffd23f' };
const PILOT = { speaker: 'Renegade Pilot', color: '#ff6a3d' };
const YOU = { speaker: 'You', color: '#5ad1ff' };

/**
 * Plays when the level starts, or none. Sector openings (1, 6, 11, 16) replace
 * the plain sector story card.
 */
export const INTRO_SCENES: Record<number, Shot[]> = {
  1: [
    { focus: 'arena', fade: true, text: 'Somewhere past Mars, the cargo ship ASTRO PAWS hums along with a hold full of ship cores...' },
    { focus: 'hero', zoom: 0.6, shake: true, reveal: 'MAYDAY!', boom: 0xff6a3d, text: 'Something grabs the ship from below. Alarms. Fire. The ship spins down towards the red planet.' },
    { focus: 'hero', zoom: 0.4, shake: true, boom: 0xd9773f, reveal: 'CRASH LANDING', text: 'Impact. Red dust everywhere. The cores are thrown all over an abandoned mining outpost.' },
    { focus: 'hero', zoom: 0.45, ...KIT, text: 'Kit to crew, sound off! ...Good, you\'re alive. Our cores are scattered across this outpost, and we are NOT alone down here.' },
    { focus: 'arena', text: 'Shapes stir under the sand. Green, wobbly, and very, very hungry.' },
    { focus: 'arena', reveal: 'SECTOR 1 · OUTPOST SURFACE', text: 'The Martian Hive is awake.' },
    { focus: 'hero', zoom: 0.5, ...KIT, text: 'Reach the Warp Gates, grab what you can, and stay out of their mouths. Go, go, go!' },
  ],
  6: [
    { focus: 'arena', fade: true, reveal: 'SECTOR 2 · DEEP SHAFTS', text: 'The core signal leads underground, into the old mining shafts.' },
    { focus: 'hero', zoom: 0.5, ...KIT, text: 'Careful down there. Phasers burrow through the walls, and Builders seal the tunnels behind you.' },
    { focus: 'arena', shake: true, text: 'Somewhere below, a generator coughs... and the lights flicker out.' },
    { focus: 'hero', zoom: 0.45, ...YOU, text: 'Great. Hungry Martians, in the dark.' },
  ],
  11: [
    { focus: 'arena', fade: true, reveal: 'SECTOR 3 · TECTONIC CORE', text: 'Deeper still. The rock is warm here, and it moves.' },
    { focus: 'arena', shake: true, text: 'The walls grind and slide. The Hive is reshaping the maze around you.' },
    { focus: 'hero', zoom: 0.5, ...KIT, text: 'The Warp Gates drift too. When you see one, don\'t wait!' },
  ],
  16: [
    { focus: 'arena', fade: true, reveal: 'SECTOR 4 · ROGUE FACILITY', text: 'At the bottom of the crust: steel doors. A facility that shouldn\'t exist.' },
    { focus: 'hero', zoom: 0.5, ...KIT, text: 'The planted hive, the metal tags, that empty pilot seat... someone built this place. Someone is using the Hive.' },
    { focus: 'arena', text: 'Red lights sweep the corridors. The Martians here hunt in packs.' },
    { focus: 'hero', zoom: 0.45, ...YOU, text: 'Then let\'s find whoever is in charge.' },
  ],
  5: [
    { focus: 'arena', fade: true, text: 'The outpost core. Something huge is pulsing under the dome...' },
    { focus: 'boss', zoom: 0.4, reveal: 'GOOPLING HIVE', shake: true, text: 'A living hive, spitting Gooplings in every direction.' },
    { focus: 'hero', ...KIT, text: 'You can\'t crack that shell. Stay alive until it burns itself out, then grab the core!' },
  ],
  10: [
    { focus: 'arena', fade: true, text: 'The bottom of the shafts. The lamps buzz... and go quiet one by one.' },
    { focus: 'boss', zoom: 0.4, reveal: 'DARKNESS HIVE', shake: true, text: 'It drinks the light. Every wave comes with a Blackout.' },
    { focus: 'hero', ...KIT, text: 'When the lights die, watch your glow and keep moving. Don\'t stop in a corner!' },
  ],
  15: [
    { focus: 'arena', fade: true, text: 'The tectonic core. The walls grind and slide like a puzzle being solved.' },
    { focus: 'boss', zoom: 0.4, reveal: 'MAZE MASTER', shake: true, text: 'It moves the maze at will, and its cross blasts sweep the whole row and column.' },
    { focus: 'hero', ...KIT, text: 'Stay off its row and column when it fires. Three waves, then it\'s done!' },
  ],
  20: [
    { focus: 'arena', fade: true, text: 'The last Warp Gate. The control room lights snap on.' },
    { focus: 'rival', zoom: 0.5, text: 'A figure in a scratched flight suit steps out of the shadows...' },
    { focus: 'rival', zoom: 0.35, reveal: 'TURNS OUT THE BOSS IS HUMAN!', shake: true, text: 'The helmet visor slides up. Not a Martian. A human pilot.' },
    { focus: 'rival', zoom: 0.4, ...PILOT, text: 'Animals in spacesuits? Cute. I woke the Hive, and it answers to ME now.' },
    { focus: 'hero', zoom: 0.45, ...YOU, text: 'Then you\'re the reason we crashed. Give back the last core!' },
    { focus: 'rival', zoom: 0.4, ...PILOT, text: 'Come and take it, little astronaut.' },
  ],
};

/** Plays when the level is cleared, before the result. */
export const OUTRO_SCENES: Record<number, Shot[]> = {
  5: [
    { focus: 'boss', zoom: 0.45, boom: 0x6fd14f, shake: true, reveal: 'HIVE DESTROYED', text: 'The Goopling Hive shudders, cracks... and collapses into goo.' },
    { focus: 'hero', ...KIT, text: 'First ship core recovered! But hives don\'t grow on their own. Someone planted that one.' },
  ],
  10: [
    { focus: 'boss', zoom: 0.45, boom: 0x8c7bff, shake: true, reveal: 'DARKNESS LIFTED', text: 'The Darkness Hive bursts, and the shaft lights flicker back on.' },
    { focus: 'boss', zoom: 0.35, text: 'In the wreckage: a metal tag. "PROPERTY OF ROGUE FACILITY".' },
    { focus: 'hero', ...KIT, text: 'Martians don\'t make metal tags. Keep going down.' },
  ],
  15: [
    { focus: 'boss', zoom: 0.45, boom: 0xff4f6d, shake: true, reveal: 'MAZE MASTER DOWN', text: 'The Maze Master\'s shell splits open. The walls stop moving.' },
    { focus: 'boss', zoom: 0.3, text: 'Inside: a pilot seat. Empty. Still warm.' },
    { focus: 'hero', ...KIT, text: 'Someone has been steering the Hive. The trail leads to the Rogue Facility. Be careful.' },
  ],
  20: [
    { focus: 'rival', zoom: 0.4, boom: 0xff6a3d, shake: true, reveal: 'PILOT DEFEATED', text: 'The Renegade Pilot drops to one knee. The last core rolls free.' },
    { focus: 'rival', zoom: 0.35, ...PILOT, text: 'Fine... take your cores. Without me the Hive goes back to sleep.' },
    { focus: 'hero', ...KIT, text: 'All cores on board! Astro Paws, get to the ship. We\'re going home!' },
  ],
};
