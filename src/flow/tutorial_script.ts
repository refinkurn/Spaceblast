import { Kind } from '../sim/constants';

// Tutorial and tip text, from the Game Guide & Tutorial Script doc.
// Plain data, so the story team can rewrite it without touching game code.
// [MOVE] and [CHARGE] are replaced with the player's own controls.

/** When a tutorial step appears (see tutorial.ts for what each one means). */
export type BeatTrigger =
  | 'level_start' // the level begins (after its level card)
  | 'after_previous' // the step before it has finished
  | 'near_target' // the step before has finished and a rock or Martian is next to you
  | 'charge_placed' // your first charge
  | 'rock_broken' // your first broken rock
  | 'item_picked' // your first power-up
  | 'martian_near' // a Martian (of `kind`, if set) comes within 3 tiles
  | 'martian_killed' // your first defeated Martian
  | 'gate_opened'; // the Warp Gate appears

/** When a step goes away (besides its time running out). */
export type BeatDone = 'moved' | 'charge_placed' | 'charge_exploded' | 'level_clear' | 'timer';

export interface Beat {
  id: string;
  /** The Story level it belongs to. */
  level: number;
  trigger: BeatTrigger;
  /** For 'martian_near': only this kind of Martian. */
  kind?: Kind;
  done: BeatDone;
  prompt: string;
}

/** The 9 beats of the narrative script: 8 on level 1, one on level 3. Each shows once per save. */
export const BEATS: Beat[] = [
  { id: 'move', level: 1, trigger: 'level_start', done: 'moved', prompt: 'Move your astronaut with [MOVE].' },
  { id: 'pillars', level: 1, trigger: 'after_previous', done: 'timer', prompt: "Pillars can't break. Hide behind one." },
  { id: 'charge', level: 1, trigger: 'near_target', done: 'charge_placed', prompt: 'Press [CHARGE] to drop a charge.' },
  { id: 'escape', level: 1, trigger: 'charge_placed', done: 'charge_exploded', prompt: 'Step away before it explodes.' },
  { id: 'rocks', level: 1, trigger: 'rock_broken', done: 'timer', prompt: "Rocks break. Look for what's behind them." },
  // The power-up and Martian beats come with their intro cards (powerup_cards.ts, alien_cards.ts).
  { id: 'powerup', level: 1, trigger: 'item_picked', done: 'timer', prompt: 'Power-up! Check the pips at the top.' },
  { id: 'martian', level: 1, trigger: 'martian_near', done: 'timer', prompt: 'Martians bite when they touch you. Keep your distance.' },
  { id: 'gate', level: 1, trigger: 'gate_opened', done: 'level_clear', prompt: 'The Warp Gate is open. Step on it to clear the level.' },
  { id: 'sniffer', level: 3, trigger: 'martian_near', kind: Kind.Sniffer, done: 'timer', prompt: "Sniffers dodge blasts. Corner them." },
];

/** What [MOVE] and [CHARGE] say, per kind of control. */
export const CONTROL_WORDS = {
  keyboard: { MOVE: 'the arrow keys', CHARGE: 'Space' },
  touch: { MOVE: 'the stick on the left', CHARGE: 'the CHARGE button' },
};

/** One is shown at random on each level briefing and on Game over. */
export const TIPS: string[] = [
  'Pillars are safe. Stand next to one before you drop a charge.',
  'A charge is only dangerous to you once it explodes. Step away before the fuse runs out.',
  'Hold a direction to keep walking. Let go to stop on the tile centre.',
  'You can change the size of the touch controls in Settings.',
  'A level only ends when you step on the Warp Gate.',
  'A charge that hits you costs a life. An Oxygen Vest saves you once.',
  'A blast destroys any power-up on its tiles, so grab it before the blast reaches it.',
  "Freeze is the emergency button: use it when you're surrounded.",
  'A Martian that walks into a blast is defeated. Use that.',
  'Freeze stops every Martian for 3 seconds. It is the best time to walk past a crowd.',
  "Bosses can't be destroyed. Survive the waves.",
  "The Maze Master's cross blast breaks rocks and destroys power-ups on its line.",
  'Breaking rocks is the fastest way to find power-ups.',
  'Keep an eye on the pips at the top: they show your power-up strength.',
  'Sound can be turned down or off in Settings.',
  'A round replay shows the last knock-out. You can shorten it or turn it off in Settings.',
];

/** Battle tips (shown between rounds). */
export const BATTLE_TIPS: string[] = [
  "Don't wait in a corner as the collapse nears. The blocks fall from the edge inward.",
  'If nobody is left when the round ends, it is a draw and nobody scores.',
  'A blast destroys any power-up on its tiles, so grab it before the blast reaches it.',
  'Pillars are safe. Stand next to one before you drop a charge.',
];
