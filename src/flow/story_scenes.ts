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
  'Now it is forbidden. A catastrophic incident decades ago awakened the native Martians. The reason has been forgotten.',
  'The Galactic Council forbids all landings.',
  "But young pilot Bosco heard a distress signal. And despite Captain Kit's warnings, he was determined to answer it.",
];

/**
 * The opening pop-up: the first time Story Mode starts on this save, after the
 * opening scene and before level 1's card. One shot, shown as a pop-up card.
 */
export const OPENING_TUTORIAL: Shot = {
  focus: 'arena', ...KIT,
  text: 'Find the Warp Gate to leave each level. Break rocks, collect power-ups, and watch your step.',
};

/**
 * Plays when the level starts, before its level card: the opening (1), the
 * sector openings (6, 11, 16), the boss intros (5, 10, 15) and the duel (20).
 */
export const INTRO_SCENES: Record<number, Shot[]> = {
  1: [
    { focus: 'arena', fade: true, text: "The cargo ship Biscuit, approaching Mars. Bosco pilots. Kit watches from the comms." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "There's a distress signal. Someone's down there." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, we're not authorized to land on Mars. The Council forbids it." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Someone's calling for help, Captain. We can't ignore that." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "It's forbidden for a reason. We don't know what we're flying into." },
    { focus: 'arena', text: "A broken voice crackles through the radio." },
    { focus: 'arena', ...DISTRESS, text: "…anyone… please… they're everywhere…" },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain, that's real. They're dying down there." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, listen to me. Do not engage." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "I'm going in." },
    { focus: 'arena', text: "Bosco adjusts the Biscuit's course toward Mars." },
    { focus: 'hero', ...KIT, pose: 'angry', text: "That's an order, Bosco!" },
    { focus: 'arena', shake: true, text: "The cockpit window fills with red dust. Alarms blare." },
    { focus: 'arena', ...SHIP_AI, text: "Unknown contact detected. Large signature. Closing fast." },
    { focus: 'arena', shake: true, boom: 0xff6a3d, text: "A massive creature erupts through the atmosphere and slams the rear engine." },
    { focus: 'hero', shake: true, ...CAPYBARA, pose: 'worried', text: "Engine's gone! We're falling!" },
    { focus: 'arena', shake: true, reveal: "CRASH LANDING", text: "The Biscuit screams downward, Mars filling the window." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "I'm sorry, Captain!" },
    { focus: 'arena', fade: true, shake: true, boom: 0xd9773f, text: "Impact. Silence. Dust settles." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "…Report?" },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, respond!" },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "Alive. The controls are dark." },
    { focus: 'hero', ...CAPYBARA, pose: 'determined', text: "Hull's intact. Engine's destroyed. But the cargo bay—it's open." },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "The power cores. They're gone." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "Someone took them." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Then we recover them. Bosco, you're going after them. I'll guide you." },
    { focus: 'arena', reveal: "SECTOR 1 · OUTPOST SURFACE", text: "Bosco steps into the Martian dust. Red sand stretches endlessly. Glowing eyes watch from the distance." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Movement detected. Be careful." },
  ],
  5: [
    { focus: 'boss', fade: true, reveal: "GOOPLING HIVE", pose: 'idle', text: "A massive organic structure fills the chamber—pulsing, wet, alive. Creatures pour from it in waves." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "That's... that's not a rock formation." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "That's the hive. Whatever's controlling these creatures, that's where it originates. You need to destroy it." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Destroy it? Captain, it's enormous!" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "It's also the thing killing everything on this planet. You don't have a choice." },
    { focus: 'boss', shake: true, pose: 'attacking', text: "The hive pulses. A wave of Gooplings erupts from its core." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Well, here we go." },
  ],
  6: [
    { focus: 'arena', fade: true, reveal: "SECTOR 2 · DEEP SHAFTS", text: "Bosco descends into a deep shaft carved through solid rock. Bioluminescent traces glow along the walls—but these are artificial. Engineered." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, those markings. They're not natural." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "What do you mean?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "I mean someone built these shafts. A long time ago. They're part of a larger structure." },
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
    { focus: 'hero', ...KIT, pose: 'determined', text: "Each hive is evolving. Adapting. Whatever's controlling them is learning. Focus, Bosco. Here they come!" },
    { focus: 'boss', shake: true, pose: 'attacking', text: "The hive unleashes a wave of creatures." },
  ],
  11: [
    { focus: 'arena', fade: true, reveal: "SECTOR 3 · TECTONIC CORE", text: "Bosco enters a massive cavern—a subterranean sea of rock and molten light. The walls pulse with geothermal energy. The ground shifts and reshapes itself as he watches." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "This is the planet's core. We're in the heart of Mars." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "And that's where the strongest hive energy is reading. Bosco, this is where it all originates." },
    { focus: 'arena', shake: true, text: "The cavern moves. Walls rebuild. A maze forms and reforms in real time." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "How is this happening?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Gravity. Heat. And something controlling it all. Look at the creatures." },
    { focus: 'arena', text: "Dozens of Martians move through the cavern in unison—not wandering, but marching. Organized. Directed toward the cavern's center." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "They're all moving toward the same point." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "The source. Whatever controls them is down here. And it's stronger than the hives you've already faced. Be careful." },
  ],
  15: [
    { focus: 'arena', fade: true, text: "The chamber is a labyrinth of shifting stone. The walls move with predatory intelligence." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "This is a maze. An actual, moving maze." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "The creature doesn't just create obstacles, Bosco. It designs them. This is strategy, not instinct." },
    { focus: 'boss', shake: true, reveal: "MAZE MASTER", pose: 'idle', text: "The Maze Master emerges—geometric, angular, alien. It controls the chamber itself." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Then I'll break both." },
  ],
  16: [
    { focus: 'arena', fade: true, reveal: "SECTOR 4 · ROGUE FACILITY", text: "Bosco enters a facility hidden within Mars itself—a command center. Screens glow with data. Holographic displays show the entire hive network: a web of control spreading across the planet." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "This is it. Central control." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "The signals originate here. Whoever's running this operation, this is their nerve center." },
    { focus: 'arena', text: "Maps shift. Hive movements update in real time. Someone is actively managing the entire system." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "And they know I'm coming." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Assume yes. You're in their territory now, Bosco. Stay sharp." },
    { focus: 'arena', text: "A shadow passes across one of the screens—deliberate, not accidental. Watching." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "I'm ready." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "I hope so." },
  ],
  20: [
    { focus: 'arena', fade: true, reveal: "CENTRAL CONTROL", text: "The control room is vast, lined with monitors showing the hive network. Blueprints of a massive weapon hang on one wall—unfinished, incomplete." },
    { focus: 'rival', pose: 'neutral', text: "Ducking stands at the center, arms crossed, watching Bosco enter." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "You made it further than the others." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Those ships. You lured them all." },
    { focus: 'rival', ...DUCKING, pose: 'neutral', text: "Five years of patience. Five ships. Four didn't even make it this far." },
    { focus: 'hero', ...KIT, pose: 'shocked', text: "Bosco… that's Ducking. He was reported missing five years ago." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You've been hunting people." },
    { focus: 'rival', ...DUCKING, pose: 'angry', text: "I've been surviving. The Division left me here to die. Mars would've been my grave. But I learned. I adapted. I found a way." },
    { focus: 'rival', pose: 'determined', text: "He gestures to the weapon blueprints." },
    { focus: 'rival', ...DUCKING, pose: 'determined', text: "And with your cores, I'll finish what I started. A weapon that commands civilized species. A tool powerful enough that no one can ignore me again." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You're insane." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "Perhaps. But I'm also inevitable." },
    { focus: 'arena', shake: true, text: "The facility locks down. The arena beneath them activates—a Maze Shift and nothing else. Final battleground." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "Last chance. Step aside, or we settle this." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Let's finish this." },
  ],
};

/** Plays when the level is cleared, before the result. */
export const OUTRO_SCENES: Record<number, Shot[]> = {
  5: [
    { focus: 'boss', shake: true, boom: 0x6fd14f, reveal: "HIVE DESTROYED", pose: 'defeated', text: "The hive convulses, then collapses in on itself. Gooplings scatter, confused, leaderless." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "That thing's finally dead." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Good work, Bosco. But that was just one hive. Our scanners show more activity deeper in the planet." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "More? How many of these things are there?" },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Unknown. But whatever's down there, it's organized. Connected. That hive was just a branch." },
    { focus: 'arena', shake: true, text: "A distant rumble echoes through the planet. The ground trembles beneath Bosco's feet." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "That can't be good." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Keep moving. We need to find the source." },
  ],
  10: [
    { focus: 'boss', shake: true, boom: 0x8c7bff, reveal: "DARKNESS LIFTED", pose: 'defeated', text: "The hive collapses. The chamber's lights flicker back on." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "Two down." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Two down. Bosco, the energy readings from the planet's core are off the scale. Whatever controls those hives, it's powerful. And it knows we're coming." },
    { focus: 'arena', text: "A sound crackles through the radio—not static. A voice. Human. Artificial." },
    { focus: 'arena', ...UNKNOWN_SIGNAL, text: "…interesting… they're learning faster than expected…" },
    { focus: 'arena', text: "The signal cuts out." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain, that wasn't a Martian." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "No. It wasn't. Keep moving. Answers are deeper." },
  ],
  15: [
    { focus: 'boss', shake: true, boom: 0xff4f6d, reveal: "MAZE MASTER DOWN", pose: 'defeated', text: "The Maze Master falls. The walls stop moving. They collapse inward, revealing a chamber beneath—one with technology. Screens. Control panels. Old mining equipment." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "This is... a mining facility." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "The Mars colony. This is what's left." },
    { focus: 'arena', text: "The control panel flickers to life. Data scrolls across the screen: radiation levels, containment failures, timestamps from decades ago." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "The radiation. It's showing containment collapse. That's what woke the Martians." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "The incident. The forgotten reason Mars was sealed. Someone was mining something dangerous. And they didn't contain it." },
    { focus: 'arena', text: "A voice emerges from the console—measured, knowing." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Captain Kit. You're beginning to understand." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Who are you?" },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "An Astropaw. Like you. I've studied everything this facility left behind. The radiation. The creatures. How to control them." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You're controlling the Martians." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "I'm using them. And with this facility's blueprints, I'm building something far more useful. A weapon that can control even civilized species." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "That's impossible." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Not impossible. Just expensive. I need a specific power core—one like yours. I've been luring ships here for five years. Yours is simply the first to reach me." },
    { focus: 'arena', text: "The console locks down. A door unseals." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Come. Let's settle this properly." },
  ],
  20: [
    { focus: 'rival', shake: true, boom: 0xff6a3d, reveal: "DUCKING CAPTURED", pose: 'hurt', text: "Bosco strikes the final blow. Ducking falls, stunned, defeated." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "It's over." },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "No. Never. I'll—" },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "You're done. We're taking you back." },
    { focus: 'arena', text: "Bosco secures Ducking. The weapon facility powers down. Inert. Incomplete." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Bosco, secure those cores. Get back to the Biscuit." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Copy that, Captain." },
  ],
};

/** Plays after the duel's outro, before the ending screen (whose text is ENDING in story.ts). */
export const ENDING_SCENE: Shot[] = [
    { focus: 'arena', fade: true, text: "The repaired Biscuit lifts off Mars. The facility's lights flicker and die. The hives wander without direction below." },
    { focus: 'arena', ...SHIP_AI, text: "All systems nominal. Warp Gate route calculated." },
    { focus: 'hero', ...KIT, pose: 'relieved', text: "We're clear. Heading home." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Finally." },
    { focus: 'hero', ...CAPYBARA, pose: 'happy', text: "Engine's purring like a kitten. We made it." },
    { focus: 'rival', pose: 'hurt', text: "A holding cell door appears on screen. Ducking sits inside, restrained, silent." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Galactic police dock receives the prisoner." },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "They'll deal with him now. He won't hunt ships again." },
    { focus: 'hero', ...CAPYBARA, pose: 'happy', text: "And the snacks survived. All of them." },
    { focus: 'hero', ...KIT, pose: 'surprised', text: "All of them?" },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "…most of them." },
    { focus: 'arena', text: "The cockpit fills with stars as Mars recedes. Bosco stands at the window, watching the planet disappear." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Next time, let's pick a less dangerous rescue mission." },
    { focus: 'hero', ...KIT, pose: 'warm', text: "Agreed. But that's not who you are, Bosco." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Yeah. I suppose not." },
    { focus: 'arena', text: "The Biscuit accelerates toward the Warp Gate. The void opens before them." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Plot set for home. Engaging warp drive in three... two... one..." },
    { focus: 'arena', shake: true, boom: 0xffffff, text: "The ship vanishes in a flash of light." },
];
