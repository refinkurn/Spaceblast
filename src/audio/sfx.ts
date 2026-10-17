import { GRID_W, Item, LevelEvent } from '../sim/constants';
import type { SimEvent } from '../sim/state';
import type { AudioEngine } from './engine';

// Sound effect recipes, one per game moment. play() maps sim events to them;
// UI sounds are called directly. To use a recorded sound instead, replace the
// body of a recipe.

/** Frequency of a note `semis` semitones from A4. */
export const note = (semis: number) => 440 * 2 ** (semis / 12);

/** Same sound at most this often (a chain reaction fires many at once). */
const MIN_GAP = 0.045;

export class Sfx {
  private last = new Map<string, number>();

  constructor(private a: AudioEngine) {}

  /** Plays the sound for a sim event. `local` is this browser's player id. */
  event(e: SimEvent, local: number): void {
    const pan = 'tx' in e ? (e.tx / (GRID_W - 1)) * 1.2 - 0.6 : 0;
    switch (e.type) {
      case 'charge_placed': return this.once('place', () => this.place(pan));
      case 'charge_exploded': return this.once('boom', () => this.boom(pan));
      case 'rock_broken': return this.once('crunch', () => this.crunch(pan));
      case 'item_picked': return this.pickup(e.item, e.id === local);
      case 'freeze': return this.freeze();
      case 'martian_killed': return this.once('splat', () => this.splat(pan));
      case 'phaser_jumped': return this.once('warp', () => this.warp());
      case 'rock_built': return this.once('build', () => this.build(pan));
      case 'event_warning': return this.alarm(e.event === LevelEvent.Blackout ? -5 : 0);
      case 'maze_shift': return this.rumble();
      case 'blackout_start': return this.powerDown();
      case 'blackout_end': return this.powerUp();
      case 'gate_opened': return this.shimmer();
      case 'gate_moved': return this.warp();
      case 'armor_hit': return this.ping();
      case 'boss_warning': return this.horn();
      case 'boss_wave': return this.horn(-5);
      case 'boss_cross': return this.zap();
      case 'boss_defeated': return this.bigBoom();
      case 'player_died': return e.id === local ? this.lose() : this.once('splat', () => this.splat(pan));
      case 'player_respawned': return e.id === local ? this.respawn() : undefined;
      case 'level_clear': return this.jingle([0, 4, 7, 12, 16]);
      case 'game_over': return this.jingle([7, 3, 0, -5], 'triangle', 0.16);
      case 'round_over': return e.winner === local ? this.jingle([0, 4, 7, 12]) : this.jingle([4, 0, -5], 'triangle', 0.14);
      case 'tile_collapsed': return this.once('thud', () => this.thud(pan), 0.09);
    }
  }

  /** UI: a light tick for buttons. */
  click(): void {
    this.a.tone({ freq: note(15), to: note(12), type: 'triangle', dur: 0.06, vol: 0.15 });
  }

  /** UI: the tap-to-start chime. */
  start(): void {
    this.jingle([0, 7, 12], 'triangle', 0.08);
  }

  /** Collapse / countdown beep (1 per second in the last 3 s). */
  beep(high = false): void {
    this.a.tone({ freq: note(high ? 15 : 10), type: 'square', dur: 0.12, vol: 0.12 });
  }

  private once(key: string, fn: () => void, gap = MIN_GAP): void {
    const t = this.a.now;
    if (t - (this.last.get(key) ?? -1) < gap) return;
    this.last.set(key, t);
    fn();
  }

  private place(pan: number): void {
    this.a.tone({ freq: 180, to: 90, type: 'sine', dur: 0.12, vol: 0.4, pan });
    this.a.noise({ dur: 0.05, freq: 3000, type: 'highpass', vol: 0.08, pan });
  }

  private boom(pan: number): void {
    this.a.noise({ dur: 0.6, freq: 1800, to: 120, vol: 0.55, pan });
    this.a.tone({ freq: 110, to: 35, type: 'sine', dur: 0.45, vol: 0.55, pan });
  }

  private bigBoom(): void {
    this.a.noise({ dur: 1.6, freq: 1200, to: 60, vol: 0.7 });
    this.a.tone({ freq: 80, to: 25, type: 'sine', dur: 1.4, vol: 0.6 });
    this.jingle([0, 4, 7, 12, 16, 19], 'square', 0.1, this.a.now + 0.5);
  }

  private crunch(pan: number): void {
    this.a.noise({ dur: 0.18, freq: 900, to: 300, type: 'bandpass', q: 2, vol: 0.35, pan });
  }

  private thud(pan: number): void {
    this.a.tone({ freq: 70, to: 30, type: 'sine', dur: 0.25, vol: 0.5, pan });
    this.a.noise({ dur: 0.15, freq: 500, to: 80, vol: 0.3, pan });
  }

  private pickup(item: number, mine: boolean): void {
    const vol = mine ? 0.22 : 0.08;
    const steps = item === Item.OxygenVest ? [0, 5, 9] : item === Item.JetBoots ? [0, 4, 7, 11] : [0, 4, 7];
    steps.forEach((s, i) => this.a.tone({ freq: note(s + 12), type: 'square', at: this.a.now + i * 0.05, dur: 0.09, vol }));
  }

  private freeze(): void {
    [24, 31, 28, 36].forEach((s, i) => this.a.tone({ freq: note(s), type: 'sine', at: this.a.now + i * 0.06, dur: 0.5, vol: 0.12 }));
  }

  private splat(pan: number): void {
    this.a.tone({ freq: 500, to: 80, type: 'sawtooth', dur: 0.2, vol: 0.18, pan });
    this.a.noise({ dur: 0.15, freq: 1500, to: 200, vol: 0.2, pan });
  }

  private warp(): void {
    this.a.tone({ freq: 300, to: 1200, type: 'sine', dur: 0.25, vol: 0.12 });
  }

  private build(pan: number): void {
    this.a.tone({ freq: 140, type: 'square', dur: 0.08, vol: 0.12, pan });
    this.a.tone({ freq: 140, type: 'square', at: this.a.now + 0.1, dur: 0.08, vol: 0.12, pan });
  }

  private alarm(shift: number): void {
    for (let i = 0; i < 3; i++) {
      this.a.tone({ freq: note(7 + shift), type: 'square', at: this.a.now + i * 0.3, dur: 0.14, vol: 0.12 });
      this.a.tone({ freq: note(3 + shift), type: 'square', at: this.a.now + i * 0.3 + 0.15, dur: 0.14, vol: 0.12 });
    }
  }

  private rumble(): void {
    this.a.noise({ dur: 1.0, freq: 200, to: 60, vol: 0.4, attack: 0.1 });
    this.a.tone({ freq: 55, to: 40, type: 'sawtooth', dur: 0.9, vol: 0.12, attack: 0.1 });
  }

  private powerDown(): void {
    this.a.tone({ freq: 600, to: 50, type: 'sawtooth', dur: 0.8, vol: 0.15 });
  }

  private powerUp(): void {
    this.a.tone({ freq: 80, to: 700, type: 'sawtooth', dur: 0.5, vol: 0.12 });
  }

  private shimmer(): void {
    [12, 16, 19, 24].forEach((s, i) => this.a.tone({ freq: note(s), type: 'triangle', at: this.a.now + i * 0.07, dur: 0.6, vol: 0.12 }));
  }

  private ping(): void {
    this.a.tone({ freq: note(24), type: 'sine', dur: 0.4, vol: 0.2 });
    this.a.tone({ freq: note(31), type: 'sine', dur: 0.3, vol: 0.1 });
  }

  private horn(shift = 0): void {
    this.a.tone({ freq: note(-17 + shift), type: 'sawtooth', dur: 0.9, vol: 0.2, attack: 0.08 });
    this.a.tone({ freq: note(-10 + shift), type: 'sawtooth', dur: 0.9, vol: 0.12, attack: 0.08, detune: 8 });
  }

  private zap(): void {
    this.a.tone({ freq: 1600, to: 100, type: 'sawtooth', dur: 0.5, vol: 0.2 });
    this.a.noise({ dur: 0.5, freq: 4000, to: 300, type: 'bandpass', q: 3, vol: 0.25 });
  }

  private lose(): void {
    this.a.tone({ freq: note(7), to: note(-12), type: 'square', dur: 0.6, vol: 0.2 });
  }

  private respawn(): void {
    this.a.tone({ freq: note(0), to: note(12), type: 'triangle', dur: 0.25, vol: 0.15 });
  }

  private jingle(steps: number[], type: OscillatorType = 'square', vol = 0.14, at = this.a.now): void {
    steps.forEach((s, i) => this.a.tone({ freq: note(s), type, at: at + i * 0.11, dur: i === steps.length - 1 ? 0.5 : 0.14, vol }));
  }
}
