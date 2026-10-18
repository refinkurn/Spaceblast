import type { Shot } from './cutscene';

// Story cutscenes, from the Master Narrative Script (Oct 18, 2026): the opening
// crash, each sector's arrival, before and after each boss, the Ducking duel and
// the ending. Lines are word for word; stage directions are narrator lines
// (no speaker). Plain data, so the story can be rewritten without touching code.

/** Captain Kit is always on the radio, aboard the Biscuit, never beside Bosco in the field. */
export const KIT = { speaker: 'Captain Kit (radio)', color: '#ffd23f', character: 'captain-kit' };
/** Bosco, the corgi Astropaw: the player. */
const BOSCO = { speaker: 'Bosco', color: '#5ad1ff', character: 'astropaw' };
/** The mechanic; stays at the crash site and rebuilds the Biscuit. */
export const CAPYBARA = { speaker: 'Capybara', color: '#c9a27a', character: 'capybara' };
/** The Renegade Pilot: a rogue Astropaw, stranded for three years. */
const DUCKING = { speaker: 'Ducking', color: '#ff6a3d', character: 'ducking' };
// Voices without a sprite.
const SHIP_AI = { speaker: 'Ship AI', color: '#9fe8ff' };
const DISTRESS = { speaker: 'Distress signal', color: '#ff8a8a' };
const UNKNOWN_SIGNAL = { speaker: 'Unknown signal', color: '#c77dff' };
const UNKNOWN_VOICE = { speaker: 'Unknown voice', color: '#c77dff' };

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
    { focus: 'arena', fade: true, text: "The cargo ship Biscuit, approaching Mars. Mars fills the window. The crew is calm, routine. Bosco sits at the helm." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Mars. Red dust, empty rocks. What could go wrong?" },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "You shouldn't ask that." },
    { focus: 'hero', ...CAPYBARA, pose: 'happy', text: "Ship's holding steady. Engines are clean. I'm actually enjoying the quiet for once." },
    { focus: 'arena', text: "The radio crackles with static. Then: a voice, broken and desperate." },
    { focus: 'arena', ...DISTRESS, text: "…anyone… receiving… please… they're everywhere… they keep—" },
    { focus: 'arena', text: "The signal cuts to white noise." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain, did you hear that?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Someone's calling from the surface. Check the scanner." },
    { focus: 'arena', text: "A contact appears on the display. Then another. Then dozens. A massive shape moves beneath them." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain? The scanner's showing something very, very large." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "How large?" },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Larger than the ship. I'm reading it as… still getting bigger." },
    { focus: 'arena', shake: true, boom: 0xff6a3d, reveal: "MAYDAY!", text: "A gigantic Martian creature erupts from the atmosphere and slams into the Biscuit's rear section. Metal screams. The ship lurches violently." },
    { focus: 'hero', shake: true, ...CAPYBARA, pose: 'worried', text: "THAT'S OUR MAIN ENGINE!" },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "WHAT IS THAT THING?!" },
    { focus: 'arena', ...SHIP_AI, text: "Hull breach, Section 4. Propulsion failure. Emergency landing protocol activated." },
    { focus: 'arena', text: "Alarms blare. Bosco grips the controls." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Bosco, keep her steady. I'm guiding you in." },
    { focus: 'hero', shake: true, ...BOSCO, pose: 'surprised', text: "Captain, this isn't steady!" },
    { focus: 'arena', shake: true, boom: 0xd9773f, reveal: "CRASH LANDING", text: "The creature drags the ship downward. The cockpit windows fill with red dust. The impact is violent." },
    { focus: 'arena', fade: true, text: "Then: silence. Dust settles." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "…Report?" },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, respond." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "Alive. Everything hurts. The controls are dark." },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "Ship's still pressurized. Hull's compromised, but we're breathing. Hang on." },
    { focus: 'arena', text: "Capybara moves through the damaged ship, checking systems." },
    { focus: 'hero', ...CAPYBARA, pose: 'determined', text: "Captain, the main engine's gone. But I can rebuild it. That's the good news." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "What's the bad news?" },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "The cargo bay doors are open. Someone—or something—got inside." },
    { focus: 'arena', text: "Capybara stares at the empty bay." },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "The power cores. They're gone." },
    { focus: 'hero', ...KIT, pose: 'surprised', text: "Gone? How is that possible?" },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "Someone opened the bay before we crashed. Took them clean." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "So we got attacked by a space monster, the ship went down, and we got robbed. All in the last five minutes." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "The cores are priority. Bosco, you're heading out. I'll guide you from the ship's systems. Capybara, begin the rebuild. We need the Biscuit running." },
    { focus: 'hero', ...CAPYBARA, pose: 'determined', text: "If you find whoever took the cores, don't bring them back here." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "I'll try." },
    { focus: 'arena', reveal: "SECTOR 1 · OUTPOST SURFACE", text: "Bosco steps into the Martian dust. The desert stretches endlessly. In the distance, two pairs of glowing eyes watch from the shadows." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Bosco, I'm detecting movement. Multiple contacts, closing." },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "I see them. Or I see their eyes, anyway." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Then move. We'll talk once you're secure." },
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
    { focus: 'rival', fade: true, pose: 'neutral', text: "The control room is vast, lined with monitors showing the hive network across Mars. Ducking stands at the center, studying the screens. He doesn't turn around." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "Hello, Bosco. I was wondering when you'd show up." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You took our power cores." },
    { focus: 'rival', ...DUCKING, pose: 'neutral', text: "I did. I need them. You'd understand if you knew what I was trying to escape." },
    { focus: 'hero', ...KIT, pose: 'surprised', text: "Bosco… that's Ducking. He was reported missing three years ago." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Three years? You've been here the whole time?" },
    { focus: 'rival', reveal: "DUCKING", ...DUCKING, pose: 'neutral', text: "I crashed here. Alone. No rescue. No support. Just me, the desert, and these creatures." },
    { focus: 'rival', pose: 'neutral', text: "He gestures to the monitors—the hive network pulses across them." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "You could've called for help. The Division—" },
    { focus: 'rival', ...DUCKING, pose: 'angry', text: "The Division? The Division abandoned me the moment I went down. They wrote me off. But I found something down here. Technology. Old Astropaw tech. I learned to use it. I learned to survive." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "You're controlling the hives." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "I'm using them. They're just animals—instinct and hunger. I gave them a direction. Purpose. And in return, they kept everyone away while I got what I needed." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You endangered the whole planet just to get the cores?" },
    { focus: 'rival', ...DUCKING, pose: 'angry', text: "I endangered nothing. The hives existed long before I got here. I just... redirected them. Made them useful." },
    { focus: 'rival', pose: 'angry', text: "He looks at Bosco directly now—desperate, fierce, unapologetic." },
    { focus: 'rival', ...DUCKING, pose: 'angry', text: "I'm going home, Bosco. With your cores or without them, those reactors are my one chance off this world. And I won't leave them in Division hands." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Then you're making the wrong choice." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "Am I?" },
    { focus: 'arena', shake: true, text: "The control system locks down. The arena beneath them activates—a final gauntlet." },
    { focus: 'rival', ...DUCKING, pose: 'sneaky', text: "Last chance. Join me, or we do this the hard way." },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "The hard way, then." },
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
    { focus: 'boss', shake: true, boom: 0xff4f6d, reveal: "MAZE MASTER DOWN", pose: 'defeated', text: "The Maze Master falls. The walls stop moving. They collapse inward, revealing a chamber beneath—one with technology. Screens. Control panels. An insignia no Martian would create." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain... this isn't alien biology. This is engineering." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Bosco, you've found something. Analyze what you're seeing." },
    { focus: 'arena', text: "The control panel flickers to life. A voice emerges—measured, patient, almost amused." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "Captain Kit. I've been monitoring your progress. Impressive." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "Who are you?" },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "An Astropaw. Like you. Like the one you're hunting." },
    { focus: 'hero', ...BOSCO, pose: 'angry', text: "You're controlling the hives." },
    { focus: 'arena', ...UNKNOWN_VOICE, text: "I'm managing the situation. But you've complicated things. Come. Let's talk. I'll show you why." },
    { focus: 'arena', text: "The door unseals with a hiss of pressurized air." },
    { focus: 'hero', ...BOSCO, pose: 'surprised', text: "Captain?" },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Go. But be careful. This is old technology. Division-era, if I'm right. Which means someone's been on Mars longer than we thought." },
  ],
  20: [
    { focus: 'rival', shake: true, boom: 0xff6a3d, reveal: "DUCKING DEFEATED", pose: 'hurt', text: "Ducking is on the ground. Defeated. The control system sparks and dies." },
    { focus: 'hero', ...BOSCO, pose: 'hurt', text: "Why? Why not just ask?" },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "Because you don't understand. Nobody understands. I've been alone on this rock for three years. Three years, Bosco." },
    { focus: 'rival', pose: 'hurt', text: "He sits up, defeated but not broken." },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "By the time I saw your ship come down, I was too far gone. Too used to doing things alone. Too afraid you'd take the cores. Turn me in to the Division." },
    { focus: 'hero', ...KIT, pose: 'worried', text: "We would've helped you." },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "Would you have? Truly? Or would I have been another body to transport back for questioning?" },
    { focus: 'hero', ...BOSCO, pose: 'neutral', text: "I guess we'll never know. Unless..." },
    { focus: 'arena', text: "Bosco extends a hand." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Unless you come back with us. Talk to Kit. We'll figure it out together." },
    { focus: 'rival', pose: 'neutral', text: "Ducking stares at the hand. A long moment. Then—he takes it." },
    { focus: 'rival', ...DUCKING, pose: 'neutral', text: "I've been alone a long time, Bosco." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Not anymore." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Bosco, secure those cores. Let's bring everyone home." },
  ],
};

/** Plays after the duel's outro, before the ending screen (whose text is ENDING in story.ts). */
export const ENDING_SCENE: Shot[] = [
    { focus: 'arena', fade: true, text: "The repaired Biscuit lifts off Mars. Below, the facility's lights flicker once, then go dark. The hives, leaderless, wander the desert once more." },
    { focus: 'arena', ...SHIP_AI, text: "All systems nominal. Warp Gate route calculated and confirmed." },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "Crew status report?" },
    { focus: 'arena', ...SHIP_AI, text: "Ship integrity: sixty-three percent. Hull breaches repaired: two hundred and fourteen. Cargo bay: secured. Life support: stable." },
    { focus: 'hero', ...CAPYBARA, pose: 'happy', text: "And the snacks are accounted for." },
    { focus: 'hero', ...KIT, pose: 'surprised', text: "All of them?" },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "...most of them." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Captain, Ducking's asking if he can have a bunk in Engineering." },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "… Tell him he can bunk with Capybara. Capybara likes company." },
    { focus: 'hero', ...CAPYBARA, pose: 'worried', text: "I do?" },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "You do now." },
    { focus: 'arena', text: "The cockpit fills with stars as Mars recedes behind them. Bosco stands at the window, watching the planet disappear. Ducking appears beside him." },
    { focus: 'rival', ...DUCKING, pose: 'neutral', text: "Three years. I thought I'd never leave." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "You're leaving now. That's what matters." },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "What about when we get back? What happens to someone like me?" },
    { focus: 'hero', ...KIT, pose: 'neutral', text: "You happen to be someone who survived alone on an alien world for three years. You happen to be someone who adapted, learned, and found a way through. That's not something the Division forgets." },
    { focus: 'rival', ...DUCKING, pose: 'hurt', text: "And if they blame me for the hives?" },
    { focus: 'hero', ...BOSCO, pose: 'determined', text: "Then we tell them the truth. You didn't wake them. You just... redirected them. And once we were there, you helped us stop them. That's a rescue story, not a crime." },
    { focus: 'arena', text: "Ducking nods. Not entirely convinced, but hopeful." },
    { focus: 'hero', ...BOSCO, pose: 'happy', text: "Besides, you're an Astropaw. You belong home more than anywhere else. Let's remind the Division what that means." },
    { focus: 'arena', text: "The Biscuit accelerates toward the Warp Gate. The void opens before them." },
    { focus: 'hero', ...KIT, pose: 'determined', text: "Plot set for home. Engaging warp drive in three... two... one..." },
    { focus: 'arena', shake: true, boom: 0xffffff, text: "The ship vanishes in a flash of light, leaving only stars and red dust behind." },
];
