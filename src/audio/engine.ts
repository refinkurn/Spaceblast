// Web Audio plumbing: one AudioContext, a music bus and an effects bus, and a
// few building blocks (tones, noise bursts) the sound recipes are made of.
// Everything is synthesised, so there are no audio files to download or
// license. Real recordings can replace a recipe later without touching callers.
// Phones only allow sound after a tap, so unlock() runs on the tap-to-start screen.

export type SoundSetting = 'all' | 'sfx' | 'off';
const PREFS_KEY = 'spaceblast.sound';

export class AudioEngine {
  ctx: AudioContext | null = null;
  music!: GainNode;
  sfx!: GainNode;
  /** Low-pass on the music (Blackout muffles it). */
  musicFilter!: BiquadFilterNode;
  private noiseBuffer: AudioBuffer | null = null;
  setting: SoundSetting = loadSetting();
  /** Volumes from Settings, 0-1. */
  private musicVolume = 0.7;
  private sfxVolume = 0.9;

  /** Creates or resumes the context. Must be called from a tap or key press. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      const master = ctx.createDynamicsCompressor(); // keeps chain reactions from clipping
      master.connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.connect(master);
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 18000;
      this.music = ctx.createGain();
      this.musicFilter.connect(this.music);
      this.music.connect(master);
      this.apply();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Settings volumes, 0-100. */
  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music / 100;
    this.sfxVolume = sfx / 100;
    this.apply();
  }

  /** Cycles all on -> effects only -> off. */
  cycle(): SoundSetting {
    this.setting = this.setting === 'all' ? 'sfx' : this.setting === 'sfx' ? 'off' : 'all';
    try { localStorage.setItem(PREFS_KEY, this.setting); } catch { /* private mode */ }
    this.apply();
    return this.setting;
  }

  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.setting === 'all' ? 0.45 * this.musicVolume : 0, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.setting === 'off' ? 0 : 0.9 * this.sfxVolume, t, 0.05);
  }

  /** A shaped oscillator note. `to` slides the pitch over the note. */
  tone(o: {
    freq: number; to?: number; type?: OscillatorType; at?: number; dur: number; vol?: number;
    attack?: number; pan?: number; bus?: 'sfx' | 'music'; detune?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const env = this.envelope(t, o.dur, o.vol ?? 0.3, o.attack ?? 0.005);
    osc.connect(env);
    this.route(env, o.pan, o.bus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  /** Filtered white noise: explosions, crunches, hats. */
  noise(o: {
    at?: number; dur: number; vol?: number; freq?: number; to?: number; q?: number;
    type?: BiquadFilterType; pan?: number; bus?: 'sfx' | 'music'; attack?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? 'lowpass';
    filter.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    filter.Q.value = o.q ?? 0.7;
    const env = this.envelope(t, o.dur, o.vol ?? 0.3, o.attack ?? 0.002);
    src.connect(filter).connect(env);
    this.route(env, o.pan, o.bus);
    src.start(t, Math.random()); // Math.random is fine here: audio only, not the sim
    src.stop(t + o.dur + 0.05);
  }

  private envelope(t: number, dur: number, vol: number, attack: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private route(node: AudioNode, pan = 0, bus: 'sfx' | 'music' = 'sfx'): void {
    const out = bus === 'music' ? this.musicFilter : this.sfx;
    if (pan) {
      const p = this.ctx!.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p).connect(out);
    } else {
      node.connect(out);
    }
  }

  private whiteNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }
}

function loadSetting(): SoundSetting {
  try {
    const v = localStorage.getItem(PREFS_KEY);
    return v === 'sfx' || v === 'off' ? v : 'all';
  } catch {
    return 'all';
  }
}
