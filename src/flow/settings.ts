// Player settings, saved on this device, and the Settings page of the menu.

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const KEY = 'spaceblast.settings';

import type { JoystickMode } from '../input/stick_geometry';

export type ControlSize = 'small' | 'normal' | 'large';
/** Round-end cinematic: replay + winner, winner only, or none. */
export type CinematicLength = 'full' | 'short' | 'off';

export interface Settings {
  /** 0-100 */
  music: number;
  sfx: number;
  controls: ControlSize;
  cinematic: CinematicLength;
  joystick: JoystickMode;
  /** Haptic buzz (only used where navigator.vibrate exists). */
  vibration: boolean;
  /** Camera shake on nearby blasts. */
  screenShake: boolean;
}

/** Players who ask for reduced motion start with screen shake off. */
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS: Settings = { music: 70, sfx: 90, controls: 'normal', cinematic: 'full', joystick: 'floating', vibration: true, screenShake: true };
export const DEFAULT_SETTINGS = DEFAULTS;
export const CONTROL_SCALE: Record<ControlSize, number> = { small: 0.82, normal: 1, large: 1.22 };

/** Saved settings, checked field by field (old or edited data falls back to defaults). */
export function loadSettings(): Settings {
  let raw: Partial<Settings> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch { /* private mode or broken data */ }
  const volume = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 100 ? v : d);
  return {
    music: volume(raw.music, DEFAULTS.music),
    sfx: volume(raw.sfx, DEFAULTS.sfx),
    controls: raw.controls === 'small' || raw.controls === 'large' ? raw.controls : DEFAULTS.controls,
    cinematic: raw.cinematic === 'short' || raw.cinematic === 'off' ? raw.cinematic : 'full',
    joystick: raw.joystick === 'fixed' ? 'fixed' : 'floating',
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : DEFAULTS.vibration,
    screenShake: typeof raw.screenShake === 'boolean' ? raw.screenShake : !prefersReducedMotion(),
  };
}

export class SettingsScreen {
  readonly value: Settings = loadSettings();

  /** `onChange` runs now and after every change. */
  constructor(private onChange: (s: Settings) => void) {
    for (const key of ['music', 'sfx'] as const) {
      const input = $(`set-${key}`) as HTMLInputElement;
      input.value = String(this.value[key]);
      input.addEventListener('input', () => this.set({ [key]: Number(input.value) }));
    }
    for (const [group, key] of [['set-controls', 'controls'], ['set-cinematic', 'cinematic'], ['set-joystick', 'joystick']] as const) {
      for (const el of $(group).children) {
        const b = el as HTMLButtonElement;
        b.addEventListener('click', () => this.set({ [key]: b.dataset.value } as Partial<Settings>));
      }
    }
    // Vibration: shown only where the browser can buzz (iOS Safari has no navigator.vibrate).
    $('set-vibration-line').hidden = !('vibrate' in navigator);
    for (const el of $('set-vibration').children) {
      const b = el as HTMLButtonElement;
      b.addEventListener('click', () => this.set({ vibration: b.dataset.value === 'on' }));
    }
    for (const el of $('set-shake').children) {
      const b = el as HTMLButtonElement;
      b.addEventListener('click', () => this.set({ screenShake: b.dataset.value === 'on' }));
    }
    this.render();
    onChange(this.value);
  }

  private set(change: Partial<Settings>): void {
    Object.assign(this.value, change);
    try { localStorage.setItem(KEY, JSON.stringify(this.value)); } catch { /* private mode */ }
    this.render();
    this.onChange(this.value);
  }

  private render(): void {
    for (const el of $('set-vibration').children) {
      el.setAttribute('aria-pressed', String((el as HTMLElement).dataset.value === (this.value.vibration ? 'on' : 'off')));
    }
    for (const el of $('set-shake').children) {
      el.setAttribute('aria-pressed', String((el as HTMLElement).dataset.value === (this.value.screenShake ? 'on' : 'off')));
    }
    for (const [group, key] of [['set-controls', 'controls'], ['set-cinematic', 'cinematic'], ['set-joystick', 'joystick']] as const) {
      for (const el of $(group).children) el.setAttribute('aria-pressed', String((el as HTMLElement).dataset.value === this.value[key]));
    }
    $('set-music-value').textContent = `${this.value.music}%`;
    $('set-sfx-value').textContent = `${this.value.sfx}%`;
  }
}
