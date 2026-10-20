import type { Shot } from './cutscene';

// Story cutscenes, from the Master Narrative Script (Oct 18, 2026) with the
// Narrative Revision of the same day (crawl, prologue, level 15 reveal, Ducking's
// capture, ending): the opening crawl and crash, each sector's arrival, before and
// after each boss, the Ducking duel and the ending. Lines are word for word; stage directions are narrator lines
// (no speaker). Plain data, so the story can be rewritten without touching code.

/** Captain Kit is always on the radio, aboard the Biscuit, never beside Bosco in the field. */
export const KIT = { speaker: 'Captain Kit (radio)', color: '#ffd23f', character: 'captain-kit' };
/** Bosco, the corgi Astropaw: the player. */
const BOSCO = { speaker: 'Bosco', color: '#5ad1ff', character: 'astropaw' };
/** The mechanic; stays at the crash site and rebuilds the Biscuit. */
export const CAPYBARA = { speaker: 'Capybara', color: '#c9a27a', character: 'capybara' };
/** The Renegade Pilot: a rogue Astropaw who lures ships to Mars for their cores. Captured at the end. */
const DUCKING = { speaker: 'Ducking', color: '#ff6a3d', character: 'ducking' };
// Voices without a sprite.
const SHIP_AI = { speaker: 'Ship AI', color: '#9fe8ff' };
const DISTRESS = { speaker: 'Distress signal', color: '#ff8a8a' };
const UNKNOWN_SIGNAL = { speaker: 'Unknown signal', color: '#c77dff' };
const UNKNOWN_VOICE = { speaker: 'Unknown voice', color: '#c77dff' };

/**
 * The opening crawl: scrolls before the level 1 scene (Skip available). One
 * string per paragraph.
 */
export const OPENING_CRAWL: string[] = [
  'Mars was once the greatest mining colony in the galaxy.',
  'Now it is forbidden. A catastrophic incident centuries ago awakened the native Martians. The reason has been forgotten.',
  'The Galactic Council forbids all landings.',
  "But young pilot Bosco heard a distress signal. And despite Captain Kit's warnings, he was determined to answer it.",
];

/**
 * The opening pop-up: the first time Story Mode starts on this save, after the
 * opening scene and before level 1's card. One shot, shown as a pop-up card.
 */
export const OPENING_TUTORIAL: Shot = {
  focus: 'arena', ...KIT,
  text: 'Blast rocks to uncover power-ups. And watch your step: your own charges can hurt you.',
};

/**
 * Plays when the level starts, before its level card: the opening (1), the
 * sector openings (6, 11, 16), the boss intros (5, 10, 15) and the duel (20).
 */
export const INTRO_SCENES: Record<number, Shot[]> = {
  1: [
    { focus: 'arena', fade: true, text: "The cargo ship Biscuit, approaching Mars. Bosco pilots. Kit is on the radio." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Storm closed our route to the Earth station gate, so we're cutting past Mars. Past, Bosco. Not down. The Council forbids landing." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Understood. Wait. There's a distress signal. Someone's down there." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, don't. We don't know what we're flying into." },
    { focus: 'arena', text: "A broken voice crackles through the radio." },
    { focus: 'arena', ...DISTRESS, text: "…anyone… please… they're everywhere…" },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Someone's calling for help, Captain. I'm going in." },
    { focus: 'arena', text: "Bosco adjusts the Biscuit's course toward Mars." },
    { focus: 'hero', ...KIT, pose: 'angry', text: "That's an order, Bosco!" },
    { focus: 'arena', shake: true, ...SHIP_AI, text: "Multiple contacts launching from the surface. Closing fast." },
    { focus: 'arena', shake: true, boom: 0xff6a3d, text: "Hundreds of Martians shoot up from the surface and stick to the hull like octopuses. They tear at the rear engine." },
    { focus: 'hero', shake: true, ...CAPYBARA, pose: 'worried', text: "They're all over the engine! We're falling!" },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Are those… space octopuses?!" },
    { focus: 'arena', shake: true, reveal: "CRASH LANDING", text: "The Biscuit screams downward, Mars filling the window." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "I'm sorry, Captain!" },
    { focus: 'arena', fade: true, shake: true, boom: 0xd9773f, text: "Impact. Silence. Dust settles." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, respond!" },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "Alive. The controls are dark." },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "Hull's intact, and the engine's fixable. But the cargo bay's been ripped open. The power cores are gone." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "The cores are what make our wormhole jumps possible. No cores, no way home." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "The Martians took them?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Martians don't steal. Someone told them to. Bosco, you're going after them. I'll guide you." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain… are we going to glow?" },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "The radiation burned out long ago. Safe to breathe, safe to walk." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Good. I'd hate to be the only thing lighting up the place." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "My scanners found the colony's old warp lines under the surface. Find the Warp Gate in each area. It's your way down." },
    { focus: 'arena', reveal: "SECTOR 1 · OUTPOST SURFACE", text: "Bosco steps into the Martian dust. Red sand stretches endlessly. Glowing eyes watch from the distance." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Movement detected. Be careful." },
  ],

  5: [
    { focus: 'boss', fade: true, reveal: "GOOPLING HIVE", pose: 'idle', text: "A massive organic structure fills the chamber—pulsing, wet, alive. Creatures pour from it in waves." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "That's... that's not a rock formation." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "That hive is launching those creatures. Someone's steering it. And it's unstable." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Great. So how do I kill it?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "You can't. But every wave burns its core hotter. After three bioplasmic discharges, it ruptures." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "And then?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Then the warp line underneath it opens. That's your way down." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "So I just don't die. Three times." },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "Preferably." },
    { focus: 'boss', shake: true, pose: 'attacking', text: "The hive pulses. A wave of Gooplings erupts from its core." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Well, here we go." },
  ],

  6: [
    { focus: 'arena', fade: true, reveal: "SECTOR 2 · DEEP SHAFTS", text: "Bosco descends into a deep shaft carved through solid rock. The walls are smooth, the floor swept, the lamps glowing." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, these shafts are centuries old. But look at them." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "Very clean for an abandoned mine." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Too clean. Somebody is maintaining them. Recently." },
    { focus: 'arena', text: "A shape moves in the darkness ahead. Too fast to identify." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "What was that?" },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Unknown. New enemy type, possibly. Don't engage if you can avoid it." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "Getting fond of empty rocks and simple Gooplings about now." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Focus. The deeper we go, the more organized these creatures become. Someone—or something—is directing them." },
  ],

  10: [
    { focus: 'arena', fade: true, text: "The chamber plunges into darkness. Only Bosco's suit glow illuminates the space." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "The lights just went out." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "I'm reading a massive energy spike. Something's waking up." },
    { focus: 'boss', shake: true, reveal: "DARKNESS HIVE", pose: 'idle', text: "The hive appears—darker than the first, crackling with electrical energy. It's twice the size." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "This one's different. Bigger. Angrier." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Each hive is evolving. Adapting. Whatever's controlling them is learning. Same rule: survive its waves and it ruptures. Here they come!" },
    { focus: 'boss', shake: true, pose: 'attacking', text: "The hive unleashes a wave of creatures." },
  ],
  11: [
    { focus: 'arena', fade: true, reveal: "SECTOR 3 · TECTONIC CORE", text: "Bosco enters a massive cavern—a subterranean sea of rock and molten light. The walls pulse with geothermal energy." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "This is the planet's core. We're in the heart of Mars." },
    { focus: 'arena', shake: true, text: "The cavern moves. Walls rebuild. A maze forms and reforms in real time." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "Same moving walls. Bigger room." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "And a stronger hand behind them. Look at the creatures." },
    { focus: 'arena', text: "Dozens of Martians move through the cavern in unison—not wandering, but marching. Organized. Directed toward the cavern's center." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "They're all moving toward the same point." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "The source. Whatever controls them is down here, and it's stronger than the hives you've already faced. Be careful." },
  ],

  15: [
    { focus: 'arena', fade: true, text: "The chamber is a labyrinth of shifting stone. The walls move with predatory intelligence." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "This is a maze. An actual, moving maze." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "So that's what's been moving the walls. This is strategy, not instinct, Bosco. Someone is steering it." },
    { focus: 'boss', shake: true, reveal: "MAZE MASTER", pose: 'idle', text: "The Maze Master emerges—geometric, angular, alien. It controls the chamber itself." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "You can't break it. Outlast it, and it burns itself out." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Then I'll outlast it." },
  ],

  16: [
    { focus: 'arena', fade: true, reveal: "SECTOR 4 · ROGUE FACILITY", text: "The tunnel opens onto a graveyard of ships: old hulls with colony and Council markings, rusted and crumpled. A few are not old at all." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain… those are ships. A lot of ships." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "I see them. Don't touch anything. Keep walking." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "Wasn't planning to." },
    { focus: 'arena', text: "Beyond the wrecks lies a facility hidden within Mars itself—a command center. Screens glow with data. Holographic displays show the entire hive network: a web of control spreading across the planet." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "This is it. Central control." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "The signals originate here. Whoever's running this operation, this is their nerve center." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "And they know I'm coming." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Assume yes. You're in their territory now, Bosco. Stay sharp." },
    { focus: 'arena', text: "A shadow passes across one of the screens—deliberate, not accidental. Watching." },
  ],

  20: [
    { focus: 'arena', fade: true, reveal: "CENTRAL CONTROL", text: "The control room is vast, lined with monitors showing the hive network. Blueprints of a massive weapon hang on one wall—unfinished, incomplete." },
    { focus: 'rival', pose: 'neutral', text: "Ducking stands at the center, arms crossed, watching Bosco enter." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "You made it further than the others." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Those ships. You lured them all." },
    { focus: 'rival', ...DUCKING, pose: 'neutral', text: "Five years of patience. Five ships. Four didn't even make it this far." },
    { focus: 'hero', ...KIT, pose: 'shocked', text: "Bosco… that's Ducking. Genius biotech. Wanted by the Galactic Police. He vanished five years ago." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You've been hunting people." },
    { focus: 'rival', ...DUCKING, pose: 'angry', text: "I've been hiding. The police wanted me for what I can do. Mars was the one place nobody would follow." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "So I built my station here. The Martians are my army, my subjects. Everyone needs a hobby." },
    { focus: 'rival', ...DUCKING, pose: 'determined', text: "With your cores, I'll finish what I started. A weapon that takes over minds. Whole worlds, working for me. Nobody ignores that." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You're insane." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "Perhaps. Insane people also finish things." },
    { focus: 'arena', shake: true, text: "The facility locks down. The arena beneath them activates—a Maze Shift and nothing else. Final battleground." },
  ],
};

/** Plays when the level is cleared, before the result. */
export const OUTRO_SCENES: Record<number, Shot[]> = {
  5: [
    { focus: 'boss', shake: true, boom: 0x6fd14f, reveal: "HIVE RUPTURED", pose: 'defeated', text: "The hive convulses, then bursts. Gooplings scatter, confused, leaderless. A glowing warp line is exposed beneath it." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "It popped. It actually popped." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Good work, Bosco. The warp line is open. But that was just one hive. Our scanners show more activity deeper in the planet." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "More? How many of these things are there?" },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Unknown. But whatever's down there, it's organized. Connected. That hive was just a branch." },
    { focus: 'arena', shake: true, text: "A distant rumble echoes through the planet. The ground trembles beneath Bosco's feet." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "That can't be good." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Keep moving. We need to find the source." },
  ],

  10: [
    { focus: 'boss', shake: true, boom: 0x8c7bff, reveal: "DARKNESS LIFTED", pose: 'defeated', text: "The hive ruptures. The chamber's lights flicker back on, and another warp line glows beneath it." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "Two down." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Two down. Bosco, the energy readings from the planet's core are off the scale. Whatever controls those hives, it's powerful. And it knows we're coming." },
    { focus: 'arena', text: "A sound crackles through the radio—not static. A voice. Not Martian. Not machine." },
    { focus: 'arena', ...UNKNOWN_SIGNAL, text: "…interesting… they're learning faster than expected…" },
    { focus: 'arena', text: "The signal cuts out." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain, that wasn't a Martian." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "No. It wasn't. Keep moving. Answers are deeper." },
  ],
  15: [
    { focus: 'boss', shake: true, boom: 0xff4f6d, reveal: "MAZE MASTER DOWN", pose: 'defeated', text: "The Maze Master collapses, spent. The walls stop moving and fold inward, revealing a chamber beneath: screens, control panels, old mining equipment under centuries of dust." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "This is... a mining facility." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "The Mars colony. This is what's left." },
    { focus: 'arena', text: "The control panel flickers to life. Data scrolls across the screen: radiation levels, containment failures, timestamps from centuries ago." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "The radiation. It's showing containment collapse. That's what woke the Martians." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Someone was mining something dangerous, and they didn't contain it." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "The Council says nobody remembers why Mars was sealed." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Nobody forgot, Bosco. The Council buried it." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Captain Kit. You're beginning to understand." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Who are you?" },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "An Astropaw. Like you. These records told me everything: the radiation, the creatures, how to bend them." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You're controlling the Martians." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "A little biotech rewires the brain. One signal, spreading host to host like a cold. The Martians were only the test. The real target is civilized minds. Whole worlds, thinking what I tell them to think." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "That's impossible." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Not impossible. Just expensive. It runs on one specific kind of core, the kind your ship carries. Five years of distress calls, one little call at a time, and yours finally paid off." },
    { focus: 'arena', text: "The console locks down. A door unseals." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Come. Let's settle this properly." },
  ],

  20: [
    { focus: 'rival', shake: true, boom: 0xff6a3d, reveal: "DUCKING CAPTURED", pose: 'hurt', text: "Bosco fires a stun blast. Ducking drops, dazed and defeated." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "It's over." },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "No. Never. I'll—" },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "You're done. The Galactic Police can have you." },
    { focus: 'arena', text: "Bosco secures Ducking. The weapon powers down, unfinished. The Biscuit's cores sit in its housing, still glowing." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Bosco, grab the cores and get back to the Biscuit." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Copy that, Captain." },
  ],
};

/** Plays after the duel's outro, before the ending screen (whose text is ENDING in story.ts). */
export const ENDING_SCENE: Shot[] = [
    { focus: 'arena', fade: true, text: "The repaired Biscuit lifts off Mars. Below, the facility's lights flicker and die. The hives wander without direction." },
    { focus: 'hero', ...CAPYBARA, pose: 'happy', text: "Cores are back in, not a scratch on them. They just need a few days to recalibrate." },
    { focus: 'hero', ...KIT, pose: 'relieved', text: "Then we take the slow way to the Earth station gate. We're heading home, one way or another." },
    { focus: 'rival', pose: 'hurt', text: "In the brig, Ducking sits restrained and silent." },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "I've called the Galactic Police. They'll meet us at the gate. He won't hunt ships again." },
    { focus: 'hero', ...CAPYBARA, pose: 'happy', text: "And the snacks survived. All of them." },
    { focus: 'hero', ...KIT, pose: 'surprised', text: "All of them?" },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "…most of them." },
    { focus: 'arena', text: "The cockpit fills with stars as Mars recedes. Bosco stands at the window, watching the planet disappear." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Next time, let's pick a less dangerous rescue mission." },
    { focus: 'hero', ...KIT, pose: 'warm', text: "Agreed. But that's not who you are, Bosco." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Yeah. I suppose not." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Course set for the Earth station gate. Nice and slow." },
    { focus: 'arena', text: "The Biscuit limps into the stars, the gate a faint light far ahead." },
];
