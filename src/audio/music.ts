import type { AudioEngine } from './engine';
import { note } from './sfx';

// A small generated soundtrack: a 4-bar loop in A minor (Am F C G) played by a
// step sequencer with a short look-ahead, so timing stays tight even when the
// game loop hiccups. Three moods: calm menu, driving game, faster boss.

export type Mood = 'none' | 'menu' | 'game' | 'boss';

/** Bass root and chord tones (semitones from A4) for each bar. */
const BARS = [
  { root: -36, chord: [0, 3, 7] }, // Am
  { root: -40, chord: [-4, 0, 3] }, // F
  { root: -33, chord: [3, 7, 10] }, // C
  { root: -38, chord: [-2, 2, 5] }, // G
];
const BPM: Record<Mood, number> = { none: 0, menu: 84, game: 118, boss: 138 };
const LOOKAHEAD = 0.15;

export class Music {
  private mood: Mood = 'none';
  private step = 0;
  private nextTime = 0;
  private timer = 0;

  constructor(private a: AudioEngine) {}

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    window.clearInterval(this.timer);
    if (mood === 'none' || !this.a.ctx) return;
    this.step = 0;
    this.nextTime = this.a.now + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  /** Blackout muffles the music. */
  muffle(on: boolean): void {
    if (!this.a.ctx) return;
    this.a.musicFilter.frequency.setTargetAtTime(on ? 500 : 18000, this.a.now, 0.3);
  }

  private schedule(): void {
    if (!this.a.ready) return;
    const sixteenth = 60 / BPM[this.mood] / 4;
    // After a long pause (tab hidden) skip ahead instead of playing a burst.
    if (this.nextTime < this.a.now - 0.2) this.nextTime = this.a.now + 0.05;
    while (this.nextTime < this.a.now + LOOKAHEAD) {
      this.play(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % (16 * BARS.length);
    }
  }

  private play(step: number, t: number, len: number): void {
    const bar = BARS[Math.floor(step / 16)];
    const s = step % 16;
    const a = this.a;
    const music = 'music' as const;
    if (this.mood === 'menu') {
      if (s === 0) for (const c of bar.chord) a.tone({ freq: note(c - 12), type: 'triangle', at: t, dur: len * 16, vol: 0.09, attack: 0.4, bus: music });
      if (s % 4 === 2) a.tone({ freq: note(bar.chord[(s / 4) % 3 | 0] + 12), type: 'sine', at: t, dur: len * 3, vol: 0.07, bus: music });
      if (s === 0 || s === 10) a.tone({ freq: note(bar.root + 12), type: 'sine', at: t, dur: len * 6, vol: 0.14, bus: music });
      return;
    }
    const boss = this.mood === 'boss';
    // Kick on the beat, hats off the beat.
    if (s % 4 === 0) a.tone({ freq: 130, to: 40, type: 'sine', at: t, dur: 0.18, vol: 0.32, bus: music });
    if (s % 4 === 2 || (boss && s % 2 === 1)) a.noise({ at: t, dur: 0.04, freq: 7000, type: 'highpass', vol: 0.06, bus: music });
    if (s === 4 || s === 12) a.noise({ at: t, dur: 0.12, freq: 1800, type: 'bandpass', vol: 0.1, bus: music });
    // Bass.
    const bassSteps = boss ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 3, 6, 8, 11, 14];
    if (bassSteps.includes(s)) a.tone({ freq: note(bar.root + (s === 14 ? 12 : 0)), type: 'sawtooth', at: t, dur: len * 1.6, vol: 0.1, bus: music });
    // Arpeggio.
    if (boss || s % 2 === 0) {
      const c = bar.chord[(boss ? s : s / 2) % 3];
      a.tone({ freq: note(c + (boss ? 0 : 12)), type: 'square', at: t, dur: len * 0.9, vol: boss ? 0.035 : 0.03, bus: music });
    }
  }
}
