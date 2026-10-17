import { AudioEngine, type SoundSetting } from '../audio/engine';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { enterFullscreen } from './fullscreen';
import type { GameState, SimEvent } from '../sim/state';

// Game audio wiring: the tap-to-start screen (phones need a tap before any
// sound), the sound buttons, button clicks, music moods and event sounds.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const ICONS: Record<SoundSetting, string> = {
  all: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  sfx: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  off: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
};
const LABELS: Record<SoundSetting, string> = { all: 'Sound: music and effects', sfx: 'Sound: effects only', off: 'Sound off' };

export class GameAudio {
  private engine = new AudioEngine();
  private sfx = new Sfx(this.engine);
  private music = new Music(this.engine);
  private buttons = [$('sound-btn'), $('menu-sound')];

  /** `onStart` runs after the first tap, once sound is unlocked. */
  constructor(onStart: () => void) {
    const start = $('start-screen');
    const go = (e: Event) => {
      if (start.hidden) return;
      e.preventDefault();
      start.hidden = true;
      this.engine.unlock();
      this.sfx.start();
      // Phones go full screen on that first tap where the browser allows it.
      if (window.matchMedia('(pointer: coarse)').matches) enterFullscreen();
      onStart();
    };
    // 'click', not 'pointerdown': hiding the screen on touch-down let the same
    // tap land on the menu button underneath it.
    start.addEventListener('click', go);
    window.addEventListener('keydown', go, { capture: true });

    for (const b of this.buttons) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.cycle();
        this.renderButtons();
      });
    }
    this.renderButtons();
    // Every button gets a soft click.
    document.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.sfx.click();
    });
    // Phones: stop the music when the app goes to the background.
    document.addEventListener('visibilitychange', () => {
      const ctx = this.engine.ctx;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  get started(): boolean {
    return $('start-screen').hasAttribute('hidden');
  }

  /** Sounds for one tick's sim events. */
  events(state: GameState, local: number): void {
    for (const e of state.events) this.event(e, local);
    // Battle: a beep each second of the collapse countdown, a high one when it starts.
    if (state.mode === 'battle' && state.status === 'playing') {
      if (state.timeLeft > 0 && state.timeLeft <= 180 && state.timeLeft % 60 === 0) this.sfx.beep();
      if (state.timeLeft === 0 && state.collapseTicks === 1) this.sfx.beep(true);
    }
  }

  private event(e: SimEvent, local: number): void {
    if (e.type === 'blackout_start') this.music.muffle(true);
    if (e.type === 'blackout_end') this.music.muffle(false);
    this.sfx.event(e, local);
  }

  /** Picks the music for what's on screen; call every frame. */
  update(state: GameState, onMenu: boolean): void {
    if (!this.started) return;
    if (onMenu) this.music.muffle(false);
    this.music.setMood(onMenu ? 'menu' : state.boss || state.rival ? 'boss' : 'game');
  }

  private renderButtons(): void {
    for (const b of this.buttons) {
      b.innerHTML = ICONS[this.engine.setting];
      b.setAttribute('aria-label', LABELS[this.engine.setting]);
      b.title = LABELS[this.engine.setting];
    }
  }
}
